console.clear()
const express = require('express');
const request = require('request')
const app = express();

const { OAuth2Client } = require("google-auth-library");
const { google } = require("googleapis");

let PORT = 8080;

const CLIENT_ID = '231696863119-lhr8odkfv58eir2l6m9bvdt8grnlnu4k.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://hollow-iodized-beanie.glitch.me/oauth2callback';
const SCOPES = 'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.students https://www.googleapis.com/auth/classroom.push-notifications https://www.googleapis.com/auth/classroom.coursework.students'.split(' ')

console.log(SCOPES)


const mongoose = require("./useDB.js");
const db = mongoose.connection;

class CourseListener {
    constructor(participantID) {
        this.participantID = participantID;
        this.sender_psid = participantID.psid;
        this.token = this.participantID.vle_accounts[0]
    }

    async listen() {


        let storedCoursesActivities;
        console.log('test')

        setInterval(async () => {
            //console.log(await this.getCourses(await this.participantID.vle_accounts[0]));
            //console.log(this.participantID.vle_accounts);
            const courses = await this.getCourses(await this.participantID.vle_accounts[0])
                .then(res => res)
                .catch(err => 'COURSES ERROR');


            if (await courses) {
                const courseActs = await Promise.all(courses.map(async (course) => {
                    const activities = await this.getCourseWork(await this.token, await course.id).then(acts => acts);

                    try {
                        return {
                            course: await course.name,
                            activities: (await activities) ? await activities.map((act) => act.title) : []
                        }
                    } catch (err) {
                        console.log(err)
                    }
                }));

                if (await !storedCoursesActivities) {
                    storedCoursesActivities = await courseActs
                }

                //console.log(courseActs)
                //console.log("STORED:")
                //console.log(storedCoursesActivities)
                //console.log("READ:")
                //console.log(courseActs);

                if (await courseActs) {
                    // checks if course list length stayed the same
                    if (courseActs.length == await storedCoursesActivities.length) {


                        let storedActs;
                        // for every courseAct
                        courseActs.forEach(courseAct => {
                            console.log("FOR EACH COURSE ACT:")
                            // for every storedAct
                            storedCoursesActivities.forEach(async storedAct => {
                                //await callSendAPI(this.sender_psid, {text:"Scanning"})
                                console.log("FOR EACH STORED ACT")
                            })
                            /*
                            if (courseAct) {
                                console.log('------------------------------')
                                console.log(courseAct.course)
                                console.log(courseAct.activities)
                            }
                            */
                        })



                        // if the course list length changed
                    } else {
                        // if the scanned course length is greater than stored
                        if (await courseActs.length > await storedCoursesActivities.length) {
                            console.log('There might be a new course added!'.toUpperCase());
                            storedCoursesActivities = courseActs;
                            await callSendAPI(await this.sender_psid, { text: `A new course has been added! Named: '${await courseActs[0].course}'` });
                        }
                        // if the scanned course is less than stored
                        else if (await courseActs.length < await storedCoursesActivities.length) {
                            console.log(`A class has been removed`.toUpperCase());

                            // find the removed course activity
                            const removedActivity = await storedCoursesActivities.find(async (activity) => await !courseActs.includes(await activity));

                            // log and send a message about the removed course activity
                            console.log(`Removed activity: ${await removedActivity}`);
                            await callSendAPI(await this.sender_psid, { text: `A class has been removed: ${await removedActivity.course}` });

                            // update the stored courses activities array
                            storedCoursesActivities = await courseActs;
                        } else {
                            console.log("IDK man")
                        }
                    }
                }
            }

            /*
            await courses.forEach(async course => {
                console.log("LISTENING...");
                console.log("--------------------------")
                const courseWork = await this.getCourseWork(await this.token, course.id).then(res => res);
                console.log(await courseWork.map(work => work.title))
                console.log("--------------------------")
            })
            */




        }, 1000);

    }

    async getCourses(token) {

        const oauth2Client = new OAuth2Client(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        )

        // Replace YOUR_ACCESS_TOKEN and YOUR_REFRESH_TOKEN with your own values
        oauth2Client.setCredentials({
            access_token: token.access_token,
            refresh_token: token.refresh_token
        });

        const classroom = google.classroom({
            version: "v1",
            auth: oauth2Client,
        });

        return new Promise((resolve, reject) => {
            classroom.courses.list({
                courseStates: 'ACTIVE'
            }, (err, res) => {
                if (err) {
                    reject(err)
                }

                const courses = res.data.courses;

                resolve(courses);
                /**
                 * 
                 * if (courses.length) {
                    console.log('Courses:');
                    courses.forEach(course => {
                        console.log(`${course.name} (${course.id})`);
                    });
                } else {
                    console.log('No courses found.');
                }
                 */
            });
        })


    }


    async getCourseWork(token, courseId) {
        const oauth2Client = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        );

        oauth2Client.setCredentials({
            access_token: token.access_token,
            refresh_token: token.refresh_token,
        });

        const classroom = google.classroom({
            version: "v1",
            auth: oauth2Client,
        });

        return new Promise((resolve, reject) => {
            classroom.courses.courseWork.list(
                {
                    courseId: courseId,
                },
                (err, res) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        const courseWork = res.data.courseWork;
                        resolve(courseWork);
                    }
                }
            );
        });
    }



}

async function getUsers() {
    db.once('open', async () => {
        const users = await db.collection('noteyfi_users').find().toArray((err, res) => res);

        users.forEach(user => {
            new CourseListener(user).listen()
        })

    })
}

getUsers()

app.listen(PORT, console.log('Server is listening to port ' + PORT))


// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
    // Construct the message body
    let request_body = {
        recipient: {
            id: sender_psid,
        },
        messaging_type: "RESPONSE",
        message: response,
    };

    // Send the HTTP request to the Messenger Platform
    return new Promise((resolve, reject) => {
        request(
            {
                uri: "https://graph.facebook.com/v2.6/me/messages",
                qs: { access_token: 'EAAGBPznQdsoBAKEgWXG7r6raGQaG1NVIo3DZC11iGPe3qlesk0fdUPZC9e98DSlIKDkY76wyzL4JqqrswsF3OZCqzUmoBTTFZCNxpUKgSk1ZAlGkoARzu6WJd7FF89SLwrIUb8M9EHQXnezDi8z4MjqvXXn38V0T5Q6Fx8xg3HnW9tydxnRJi' },
                method: "POST",
                json: request_body,
            },
            (err, res, body) => {
                if (!err) {
                    resolve(console.log("message sent!"));
                } else {
                    reject(console.error("Unable to send message:" + err));
                }
            }
        );
    });
}

