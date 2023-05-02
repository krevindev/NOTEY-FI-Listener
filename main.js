const request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()),
  axios = require('axios')
const mongoose = require('./useDB.js');
const db = mongoose.connection;
const moment = require('moment')



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
//
app.get('/', (req, res) => {
  console.log("Pinged!")
  res.send('Listener Running...')
})

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

app.post('/set_reminder', async (req, res) => {
  let body = await req.body
  const sender_psid = await body.sender_psid[0]
  const time = await body.time.substring(0, body.time.length - 1)
  let timeUnit =
    (await body.time[(await body.time.length) - 1]) === 'd'
      ? 'days'
      : (await body.time[(await body.time.length) - 1]) === 's'
        ? 'seconds'
        : (await body.time[(await body.time.length) - 1]) === 'h'
          ? 'hours'
          : (await body.time[(await body.time.length) - 1]) === 'm'
            ? 'minutes'
            : undefined
  if (time == 1) timeUnit = timeUnit.substring(0, timeUnit.length - 1)
  const course = await body.course
  const courseWork = await body.courseWork

  const dueDate = new Date(
    courseWork.dueDate.year,
    courseWork.dueDate.month - 1, // Subtract 1 from the month value
    courseWork.dueDate.day,
    courseWork.dueTime.hours !== undefined ? courseWork.dueTime.hours + 8 : 11,
    courseWork.dueTime.minutes !== undefined ? courseWork.dueTime.minutes : 59
  )

  console.log('DATE:')
  console.log(courseWork.dueDate)
  console.log('TIME:')
  console.log(courseWork.dueTime)

  const reminderDate = await moment(await dueDate).subtract(
    await time,
    timeUnit
  )
  let currentDate = await moment(new Date()).add(8, 'hours')

  const formattedReminderDate = reminderDate.format(
    'dddd, MMMM Do YYYY, h:mm:ss a'
  )
  const formattedDueDate = moment(dueDate).format(
    'dddd, MMMM Do YYYY, h:mm:ss a'
  )
  const formattedCurrentDate = moment(currentDate).format(
    'dddd, MMMM Do YYYY, h:mm:ss a'
  )

  /** Date format end */

  const response = {
    attachment: {
      type: 'template',
      payload: {
        template_type: 'button',
        text: `REMINDER!
        \nYou have an upcoming deadline for an activity!
        \n
        \n
        \nCourse: \n${await course.name}
        \nActivity: ${await courseWork.title}
        `,
        buttons: [
          {
            type: 'web_url',
            url: courseWork.alternateLink,
            title: `Go to Activity`,
            webview_height_ratio: 'full'
          },
          {
            type: 'postback',
            title: `Return to Menu`,
            webview_height_ratio: 'full',
            payload: 'menu'
          }
        ]
      }
    }
  }
  async function getUser(sender_psid) {
    return new Promise(async (resolve, reject) => {
      await db
        .collection('noteyfi_users')
        .findOne({ psid: String(sender_psid) }, (err, result) => {
          if (err) {
            reject('Rejected')
          } else {
            resolve(result)
          }
        })
    })
  }

  class SetReminder {
    constructor(reminderDate, sender_psid, response) {
      this.reminderDate = reminderDate
      this.sender_psid = sender_psid
      this.response = response
      this.listenerInterval
    }

    async start() {




      this.sendConfirmation()
      this.listenerInterval = setInterval(async () => {

        const user = await getUser(sender_psid).then(user => user).catch(err => null);

        if (user) {
          currentDate = moment(new Date()).add(8, 'hours')
          console.log('CHECKING')
          console.log(courseWork.title)

          if (
            reminderDate.isSame(currentDate) ||
            currentDate.isAfter(reminderDate)
          ) {
            this.sendReminder()
            this.stop()
          } else {
            console.log(currentDate)
            console.log(reminderDate)
          }
        } else {
          this.stop()
        }
      }, 2000)
    }
    async stop() {
      clearInterval(this.listenerInterval)
    }

    async sendConfirmation() {
      await callSendAPI(this.sender_psid, {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: `You have successfully set a reminder!
          \nYou will be Reminded ${time} ${timeUnit} before ${formattedDueDate}
          \nReminder Date: ${formattedReminderDate}
          \nDeadline Date: ${formattedDueDate}`,
            buttons: [
              {
                type: 'postback',
                title: `Return to Menu`,
                webview_height_ratio: 'full',
                payload: 'menu'
              }
            ]
          }
        }
      })
    }
    async sendReminder() {
      await callSendAPI(this.sender_psid, this.response)
    }
  }

  new SetReminder(await reminderDate, await sender_psid, await response).start()
})

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

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid
    },
    messaging_type: 'RESPONSE',
    message: response
  }

  // Send the HTTP request to the Messenger Platform
  return new Promise((resolve, reject) => {
    request(
      {
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
        method: 'POST',
        json: request_body
      },
      (err, res, body) => {
        if (!err) {
          resolve(console.log('message sent!'))
        } else {
          reject(console.error('Unable to send message:' + err))
        }
      }
    )
  })
}
