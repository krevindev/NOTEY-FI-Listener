const request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()),
  axios = require('axios')
const mongoose = require('./useDB.js');
const db = mongoose.connection;


const CourseListener = require('./CourseListener').CourseListener;

app.use(express.json()); // Enable JSON request body parsing

/** Pass a user here to listen to */
async function listenToUser(user) {
  new CourseListener(user).listenCourseChange();
  new CourseListener(user).pushNotification();

  //addToCache(user.psid, user);
}

app.post('/pass_data', async (req, res) => {
  const user = req.body;

  await listenToUser(user)

  console.log(user.name)
  //res.status(200).send('Notification received')
})


db.once('open', async () => {
  await db.collection('noteyfi_users').find().toArray((err, res) => {
    const users = res
    users.forEach(async user => {
      try {
        // if the user has a vle_accounts property
        if (user.vle_accounts) {
          // create CourseListeners to the user
          listenToUser(user);
        }
      } catch (err) {
        console.log("User DB Error");
        console.log("Error: " + err)
      }
    })
  });

})

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('listener server is running'))