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
  const new_user = new CourseListener(user);
  subscribed_users.push(new_user)
  subscribed_users[subscribed_users.length - 1].listen()
  console.log("Started Listening to " + user.name)
  //addToCache(user.psid, user);
}


// app.post('/pass_data', async (req, res) => {
//   const user = req.body;

//   if(!subscribed_users.includes(user.psid)) {
//     await listenToUser(user)
//   }else{
//     console.log(`I'm already listening to ${user.name}`)
//   }

//   console.log(user.name)
//   //res.status(200).send('Notification received')
// })

app.post('/pass_data', async (req, res) => {
  const user = req.body;

  const existingUserIndex = subscribed_users.findIndex(u => u.psid === user.psid);

  if (existingUserIndex >= 0) {
    subscribed_users[existingUserIndex] = user;
    console.log(`Replaced existing user: ${user.name}`);
  } else {
    await listenToUser(user);
    console.log(`Started listening to new user: ${user.name}`);
  }

  console.log(user.name);

  res.status(200).send('Notification received');
})

app.post('/stop_listening', async (req, res) => {
  const psid = req.body.psid;

  console.log(req.body)

  const listenerIndex = subscribed_users.findIndex(su => String(su.participantID.psid) === String(psid));

  if (listenerIndex >= 0) {
    const listener = subscribed_users[listenerIndex];
    listener.stop(); // Stop listening to the course changes
    subscribed_users.splice(listenerIndex, 1); // Remove the listener from the array
    console.log(`Stopped listening to user: ${req.body.name}`);
  } else {
    console.log(`No listener found for psid: ${psid}`);
  }

  res.status(200).send('Stop listening request received');
});

// app.post('/stop_listening', (req, res) => {
//   const user = req.body;

//   console.log(subscribed_users.map(su => su.participantID.psid));

//   const userIndex = subscribed_users.findIndex(u => {
//     console.log(u.participantID.psid)
//     return String(u.participantID.psid) == user.psid
//   });

//   if (userIndex >= 0) {
//     const user = subscribed_users[userIndex];
//     const listener = new CourseListener(user);

//     listener.stop();
//     subscribed_users.splice(userIndex, 1);

//     console.log(`Stopped listening to user: ${user.name}`);
//     res.status(200).send(`Stopped listening to user: ${user.name}`);
//   } else {
//     console.log(`User with psid ${user.psid} not found`);
//     res.status(404).send(`User with psid ${user.psid} not found`);
//   }
// })


// Sets server port and logs message on success
app.listen(process.env.PORT || 13037, () => console.log('listener server is running'))


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
