const request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()),
  axios = require('axios')
const mongoose = require('./useDB.js');
const db = mongoose.connection;


const CourseListener = require('./CourseListener').CourseListener;

let subscribed_users = [];

app.use(express.json()); // Enable JSON request body parsing

/** Pass a user here to listen to */
async function listenToUser(user) {
  subscribed_users.push(user.psid);
  new CourseListener(user).listenCourseChange();
  new CourseListener(user).pushNotification();

  console.log("Started Listening to " + user.name)
  //addToCache(user.psid, user);
}


app.post('/pass_data', async (req, res) => {
  const user = req.body;

  if(!subscribed_users.includes(user.psid)) {
    await listenToUser(user)
  }else{
    console.log(`I'm already listening to ${user.name}`)
  }

  console.log(user.name)
  //res.status(200).send('Notification received')
})

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('listener server is running'))


async function listenToExistingUsers() {
  db.once('open', async () => {
    const users = await db.collection('noteyfi_users').find().toArray();

    users.forEach(async user => {
      //console.log(user);
      try {
        if (user.vle_accounts) {
          await listenToUser(user);
        }
      } catch (err) {
        console.log('User DB Error');
        console.log('Error: ' + err);
      }
    });
  });
}

listenToExistingUsers();
