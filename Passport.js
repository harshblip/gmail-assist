const GoogleStrategy = require('passport-google-oauth20').Strategy;

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/callback"
      },
      function (accessToken, refreshToken, profile, done) {
        // profile.accessToken = accessToken;
        // profile.refreshToken = refreshToken; 
        profile.email = profile.emails[0].value;
        console.log(accessToken);
        console.log('User authenticated successfully');
        return done(null, profile);
      }
    )
  );

  passport.serializeUser(function (user, done) {
    done(null, { id: user.id, email: user.email });
  });

  passport.deserializeUser(function (user, done) {
    done(null, user);
  });
};


