import $$ from 'dom7';
import Framework7 from 'framework7/framework7.esm.bundle.js';

var version = '[AIV]{date}[/AIV]';

// Import F7 Styles
import 'framework7/css/framework7.bundle.css';

// Import Icons and App Custom Styles
import '../css/icons.css';
import '../css/app.css';

// Import Routes
import routes from './routes.js';

import {
  Stitch,
  UserPasswordCredential,
  FacebookRedirectCredential,
  GoogleRedirectCredential
} from 'mongodb-stitch-browser-sdk'
const APP_ID = 'GITHUB_STITCH_APP_ID';
const MONGO_DATABASE = 'diary';
const EV_PLACES  = 'ev_places';
const EV_LOGBOOK = 'ev_logbook';

var Objectify = function(s) {
  return Stitch.BSON.ObjectID(s);
};

// v4 initialization
var stitchClient = Stitch.initializeDefaultAppClient(APP_ID);
var db = stitchClient.getServiceClient(stitch.RemoteMongoClient.factory, 'mongodb-atlas').db(MONGO_DATABASE);
var loggedInUser = "N/A";
var loggedInEmail = "N/A";
var stitchUserId = "nil";

if (stitchClient.auth.isLoggedIn) {
  console.log("Stitch client logged in");
  loggedInEmail = stitchClient.auth.user.profile.email;
  loggedInUser = stitchClient.auth.user.profile.firstName;
  stitchUserId = stitchClient.auth.user.id;
}
else {
  if (stitchClient.auth.hasRedirectResult()) {
    stitchClient.auth.handleRedirectResult().then(user => {
      console.log("Authenticated via Google OAuth: ", user);
    }).catch(err => {
      console.error("Failed to authenticate:");
      console.error(err);
    });
  }
  else {
    const credential = new GoogleRedirectCredential();
    console.log("Authenticating through Google OAuth...");
    stitchClient.auth.loginWithRedirect(credential);
  }
}

var app = new Framework7({
  root: '#app', // App root element

  name: 'Compliance Diary', // App name
  theme: 'auto', // Automatic theme detection
  // App root data
  data: function () {
    return {
      db: db,
      Objectify: Objectify,
      stitchClient: stitchClient,
      loggedInUser: loggedInUser,
      loggedInEmail: loggedInEmail,
      stitchUserId: stitchUserId,
      // Test data
      user: {
        firstName: 'John',
        lastName: 'Doe',
      },
    };
  },
  // App root methods
  methods: {
    helloWorld: function () {
      app.dialog.alert('Hello World!');
    },
  },
  // App routes
  routes: routes,
});

// Login Screen Demo
$$('#my-login-screen .login-button').on('click', function () {
  var username = $$('#my-login-screen [name="username"]').val();
  var password = $$('#my-login-screen [name="password"]').val();

  // Close login screen
  app.loginScreen.close('#my-login-screen');

  // Alert username and password
  app.dialog.alert('Username: ' + username + '<br>Password: ' + password);
});
