const express = require('express')
const { google } = require('googleapis');
const passport = require('passport')
const session = require('express-session')
require('dotenv').config();
const app = express()
const gmail = google.gmail('v1')
const OAuth2 = google.auth.OAuth2;

app.use(session({
  secret: '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',
  resave: true,
  saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())

require('./Passport')

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }))

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    res.redirect('/autoreply')
    // res.redirect('/success')
  })

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html')
})
let access_token;
app.get('/success', (req, res) => {
  console.log(req.user.accessToken);
  access_token = req.user.accessToken;
  res.sendFile(__dirname + '/success.html')
})


app.get('/autoreply', async (req, res) => {

  if (!req.user) {
    return res.status(401).send('user not authenticated');
  }

  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials(req.user.accessToken);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  gmail ? async function getUnrepliedMessages(gmail) {
    const res = await gmail.users.messages.list({
      userId: '${req.user.email}',
      q: '-in:chat -from:me -has:userlabels'
    });

    return res.data.messages || [];
  }:null


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
    userId: 'me',
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
    `From: me`,
    `To: ${replyTo}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${message.id}`,
    `References: ${message.id}`,
    ``,
    replyBody
  ].join('\n');

  const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });
}

app.listen(3000, () => console.log('Server listening on port 3000'))