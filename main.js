const request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()),
  axios = require('axios')

const CourseListener = require('./CourseListener').CourseListener

app.use(express.json()); // Enable JSON request body parsing

/** Pass a user here to listen to */
async function listenToUser(user) {
  // new CourseListener(user).listenCourseChange();
   //new CourseListener(user).pushNotification();

   axios.post('https://classroom-listener-server.glitch.me/pass_data', user)
         .then(response => {
           console.log(`Created listener for ${user.name}`, response.data)
         })
         .catch(error => {
           console.error('Failed to register listener: ', error.message)
         })

   //addToCache(user.psid, user);
}

app.post('/pass_data', async (req, res) => {
  const user = req.body;

  await listenToUser(user);

  console.log("RECEIVED DATA: ")
  console.log(user.name)
  res.status(200).send('Notification received')
})

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('listener server is running'))