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
const MONGO_DATABASE = 'GITHUB_MONGO_DATABASE_NAME';

import { DateTime } from "luxon";

const tz = 'US/Pacific';
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
      loggedInEmail = stitchClient.auth.user.profile.email;
      loggedInUser = stitchClient.auth.user.profile.firstName;
      stitchUserId = stitchClient.auth.user.id;
      if (stitchClient.auth.user.customData.app_roles) {
        console.log(`App roles: ${stitchClient.auth.user.customData.app_roles}`);
      }
      else {
        stitchClient.callFunction('restoreRoles', []).then(res => {
          if ( res.status == true ) {
            app.dialog.alert(res.roles.join(", "), "Roles restored:", function () {
              stitchClient.auth.logout();
              const credential = new GoogleRedirectCredential();
              stitchClient.auth.loginWithRedirect(credential);
            });
          }
          else {
            app.dialog.alert(res.reason, "Role restoration failed");
          }
        })
        .catch(err => {
          app.dialog.alert(err, "Failed to call restoreRoles function");
        });
      }
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

  name: 'Diary', // App name
  theme: 'ios', // Automatic theme detection
  // App root data
  data: function () {
    return {
      db: db,
      tz: tz,
      Objectify: Objectify,
      stitchClient: stitchClient,
      loggedInUser: loggedInUser,
      loggedInEmail: loggedInEmail,
      stitchUserId: stitchUserId,
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

$$('#btnObtainRoles').on('click', function obtainRoles() {
  const cl = app.data.stitchClient;
  app.dialog.password(
    "Enter a token:",
    "Assign Roles",
    function acceptToken(token) {
      cl.callFunction('assignAppRoles', [token]).then(res => {
        if ( res.status == true ) {
          app.dialog.alert(res.roles.join(", "), "Roles assigned:", function () {
            cl.auth.logout();
            const credential = new GoogleRedirectCredential();
            cl.auth.loginWithRedirect(credential);
          });
        }
        else {
          app.dialog.alert(res.reason, "Role assignment failed");
        }
      })
      .catch(err => {
        app.dialog.alert(err, "Failed to call assignAppRoles function");
      });
    },
    function refuseToken(token) {
      console.log("token cancelled");
    });
});
