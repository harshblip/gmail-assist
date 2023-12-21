const express = require('express')
const { google } = require('googleapis');
const passport = require('passport')
const session = require('express-session')
require('dotenv').config();
const app = express()
const gmail = google.gmail('v1')
const OAuth2 = google.auth.OAuth2;
const GoogleStrategy = require('passport-google-oauth20').Strategy;

app.use(session({
  secret: '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',
  resave: true,
  saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())

let accesstoken
let uemail
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback"
    },
    function (accessToken, refreshToken, profile, done) {
      accesstoken = accessToken;
      uemail = profile.emails[0].value;
      profile.id = profile.id;
      console.log('User authenticated successfully');
      return done(null, profile);
    }
  )
);
console.log('ye rha -> ', accesstoken)
passport.serializeUser((userObj, done) => {
  done(null, userObj)
});

passport.deserializeUser((userObj, done) => {
  done(null, userObj)
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }))

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    console.log('ye rha -> ', accesstoken, uemail)
    res.redirect('/autoreply')
  })

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html')
})
app.get('/success', (req, res) => {
  res.sendFile(__dirname + '/success.html')
})

app.get('/autoreply', async (req, res) => {

  if (!req.user) {
    return res.status(401).send('user not authenticated');
  }

  const oauth2Client = new OAuth2();
  oauth2Client.setCredentials({
    access_token: accesstoken,
  });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  async function getUnrepliedMessages(gmail) {
    const res = await gmail.users.messages.list({
      userId: `${uemail}`,
      q: '-in:chat -from:me -has:userlabels'
    });

    return res.data.messages || [];
  }

  if (gmail) {
    const messages = await getUnrepliedMessages(gmail);
    for (let message of messages) {
      await sendReply(gmail, message);
      console.log(`Replied to: ${message.id}`);
    }
  } else {
    console.log('Gmail object is undefined');
  }


  res.send(`Replied to ${messages.length} messages.`);

})

async function sendReply(gmail, message) {
  const res = await gmail.users.messages.get({
    userId: `${uemail}`,
    id: message.id,
    format: 'metadata',
    metadataHeaders: ['Subject', 'From'],
  });

  const subject = res.data.payload.headers.find(header => header.name == 'Subject').value;
  const from = res.data.payload.headers.find(header => header.name == 'From').value;
  const replyTo = from.match(/<(.*)>/)[1];
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
  const replyBody = `Hey, I am out of office. Call you later`;

  const rawMessage = [
    `From: ${uemail}`,
    `To: ${replyTo}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${message.id}`,
    `References: ${message.id}`,
    ``,
    replyBody
  ].join('\n');

  const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: `${uemail}`,
    requestBody: {
      raw: encodedMessage,
    },
  });
}

app.listen(3000, () => console.log('Server listening on port 3000'))