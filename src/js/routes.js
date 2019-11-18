
import HomePage from '../pages/home.f7.html';
import AboutPage from '../pages/about.f7.html';
import FormPage from '../pages/form.f7.html';

import DynamicRoutePage from '../pages/dynamic-route.f7.html';
import RequestAndLoad from '../pages/request-and-load.f7.html';
import NotFoundPage from '../pages/404.f7.html';

import EVLogbookRouter from '../pages/ev-logbook-router.f7.html';
import EVLogbookEntry from '../pages/ev-logbook-entry.f7.html';

import BVLogEntry from '../pages/bv-log-entry.f7.html';

var routes = [
  {
    path: '/',
    component: HomePage,
  },
  {
    path: '/about/',
    component: AboutPage,
  },
  {
    path: '/form/',
    component: FormPage,
  },
  {
    path: '/bv-log-entry/',
    component: BVLogEntry,
  },
  {
    path: '/ev-logbook-entry/id/:Id/spots/:MaxSpots/name/:Name/',
    component: EVLogbookEntry,
  },
  {
    path: '/ev-logbook/',
    async: function (routeTo, routeFrom, routeResolve, reject) {
      // Router instance
      var router = this;

      // var evCandidates = [];

      // App instance
      var app = router.app;

      // Show Preloader
      app.preloader.show();

      // https://gist.github.com/varmais/74586ec1854fe288d393#gistcomment-2577637
      var getCurrentPosition = function () {
        if (navigator.geolocation) {
          return new Promise(
            (resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 100, timeout: 3000, enableHighAccuracy: true })
          )
        } else {
          return new Promise(
            resolve => resolve({})
          )
        }
      };

      getCurrentPosition().then(position => {
        app.data.db.collection('ev_places').find({'l':{'$near':{'$geometry':{'type':'Point','coordinates':[position.coords.longitude, position.coords.latitude]},'$maxDistance': 180}}}).toArray().then(docs => {
          // evCandidates = [].concat(docs);
          app.preloader.hide();
          // console.log("Resolving to EVLogbookRouter with:");
          // console.log(evCandidates);
          if (docs.length === 1) {
            var spot = docs[0];
            // console.log("Only single EV place found:");
            // console.log(spot);
            // console.log("Redirecting to EVLogbookEntry");
            routeResolve(
              {
                component: EVLogbookEntry,
              },
              {
                context: {
                  Id: spot._id,
                  MaxSpots: spot.max_spots,
                  Name: spot.name,
                }
              }
            );
          } else {
            routeResolve(
              {
                component: EVLogbookRouter,
              },
              {
                context: {
                  lat: position.coords.latitude,
                  lon: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  EVPlaces: docs,
                }
              }
            );
          }
	}).catch(e => {
	  console.error(e);
	});
      }).catch(err => {
        // Failure to determine current coordinates
        // Hide Preloader
        app.data.db.collection('ev_places').find({},{'sort':{'last_updated_on': -1}}).toArray().then(docs => {
          // evCandidates = [].concat(docs);
          app.preloader.hide();
          // console.log("Resolving to EVLogbookRouter with:");
          // console.log(evCandidates);
          routeResolve(
            {
              component: EVLogbookRouter,
            },
            {
              context: {
                error: err,
                EVPlaces: docs,
              }
            }
          );
	}).catch(e => {
	  console.error(e);
	});
      });
    },
  },
  {
    path: '/dynamic-route/blog/:blogId/post/:postId/',
    component: DynamicRoutePage,
  },
  {
    path: '/request-and-load/user/:userId/',
    async: function (routeTo, routeFrom, resolve, reject) {
      // Router instance
      var router = this;

      // App instance
      var app = router.app;

      // Show Preloader
      app.preloader.show();

      // User ID from request
      var userId = routeTo.params.userId;

      // Simulate Ajax Request
      setTimeout(function () {
        // We got user data from request
        var user = {
          firstName: 'Vladimir',
          lastName: 'Kharlampidi',
          about: 'Hello, i am creator of Framework7! Hope you like it!',
          links: [
            {
              title: 'Framework7 Website',
              url: 'http://framework7.io',
            },
            {
              title: 'Framework7 Forum',
              url: 'http://forum.framework7.io',
            },
          ]
        };
        // Hide Preloader
        app.preloader.hide();

        // Resolve route to load page
        resolve(
          {
            component: RequestAndLoad,
          },
          {
            context: {
              user: user,
            }
          }
        );
      }, 1000);
    },
  },
  {
    path: '(.*)',
    component: NotFoundPage,
  },
];

export default routes;
