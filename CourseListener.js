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
        this.token = this.participantID.vle_accounts[0];
    }
    async listen() {

        console.log('test');

        let storedCourseList;

        setInterval(async () => {

            const courseList = await this.getCourses(this.token)
                .then((c) => c);

            const courseWorksObj = await Promise.all(courseList.map(async (course) => {
                try {
                    const courseWork = await this.getCourseWorks(this.token, course.id);
                    return {
                        courseName: course.name,
                        coursework: courseWork
                    };
                } catch (err) {
                    console.log(err);
                    return null;
                }
            }));

            if (!storedCourseList) storedCourseList = await courseList;

            if (await courseList && await storedCourseList && await courseWorksObj) {
                let storedCourseWork;

                if (storedCourseList.length === await courseList.length) {


                    await courseList.map(async course => {
                        let reqCourseWork = courseWorksObj.filter(obj => obj.courseName == course.name)
                            .map(course => {
                                if (course.coursework) {
                                    const ret = course.coursework.map(work => work)
                                    return ret.map(r => r)
                                } else {
                                    return []
                                }
                            }).map(course => course.map(c => c.title))
                        reqCourseWork = await reqCourseWork[0];


                        console.log('NEWNEW----------------')
                        if (!storedCourseWork) storedCourseWork = await reqCourseWork;

                        if (await reqCourseWork.length === storedCourseList.length) {
                            console.log("REQ:")
                            console.log(reqCourseWork);
                            console.log("STORED:");
                            console.log(storedCourseWork);
                        } else {
                            console.log('NOTIFIED!!!')
                        }
                    })

                } else if (await storedCourseList.length < await courseList.length) {
                    //console.log('ADDED');
                    //await callSendAPI(await this.sender_psid, { text: 'A new course has been added!' })
                } else if (await storedCourseList.length > await courseList.length) {
                    //console.log('REMOVED');
                    //await callSendAPI(await this.sender_psid, { text: 'A course has been removed!' })
                }

                storedCourseList = courseList
            }

            //console.log(await courses.map(course => course.name));
            //console.log(courseWorksObj.map(courseWork => courseWork.coursework.map(work => work.title)));
            console.log('---------------------------')

        }, 1000);

    }

    async pushNotification() {
        console.log('PUSH')
        const auth = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        );

        auth.setCredentials({
            // Replace the following with your own values
            access_token: this.token.access_token,
            refresh_token: this.token.refresh_token
        });

        const classroom = google.classroom({
            version: 'v1',
            auth: auth
        });

        // Set up a unique channel ID to use for push notifications
        // Keep track of the latest activity time by course ID

        // Keep track of the latest activity time by course ID
        let latestActivityTimeByCourseId = {};
        let earliestActivityTimeByCourseId = {};
        let existingCourseworkIds = {};

        async function checkForActivityChanges(sender_psid) {
            const courses = await classroom.courses.list({
                courseStates: ['ACTIVE']
            });

            for (const course of courses.data.courses) {
                const courseId = course.id;

                const latestActivityTime = latestActivityTimeByCourseId[courseId];

                let activityChanges;

                if (latestActivityTime) {
                    activityChanges = await classroom.courses.courseWork.list({
                        courseId: courseId,
                        orderBy: 'updateTime desc',
                        pageSize: 1,
                        pageToken: null,
                        //fields: 'courseWork(id,title),courseId'
                    });
                } else {
                    activityChanges = await classroom.courses.courseWork.list({
                        courseId: courseId,
                        orderBy: 'updateTime desc',
                        pageSize: 1,
                        pageToken: null,
                        //fields: 'courseWork(id,title),courseId'
                    });
                }

                try {
                    if (activityChanges.data.courseWork) {
                        if (activityChanges.data.courseWork.length > 0) {





                            const activity = activityChanges.data.courseWork[0];

                            const activityTime = new Date(activity.updateTime).getTime();

                            if (await latestActivityTime && await activityTime > await latestActivityTime) {
                                let activityLink;
                                let activityType = '';

                                if (activity.workType === 'ASSIGNMENT') {
                                    activityType = 'work';
                                } else if (activity.workType === 'TOPIC') {
                                    activityType = 'topic';
                                } else {
                                    console.log(`Unknown work type for activity "${activity.title}"`);
                                    continue;
                                }
                                activityLink = `https://classroom.google.com/c/${courseId}/${activityType}/${activity.id}`;

                                // activity deadline Date
                                let dueDate = new Date(activity.dueDate.year, activity.dueDate.month, activity.dueDate.date); // Note that month is zero-indexed, so April (4th month) is represented by 3
                                const longDateFormat = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                                dueDate = dueDate.toLocaleDateString('en-US', longDateFormat); // Output: Friday, April 15, 2023


                                const response = {
                                    attachment: {
                                        type: "template",
                                        payload: {
                                            template_type: "button",
                                            text: `NEW ACTIVITY ADDED! from ${course.name}\n'${activity.title}'
                                            \n\nDESCRIPTION:
                                            \n ${activity.description}
                                            DEADLINE: ${dueDate}`,
                                            buttons: [
                                                {
                                                    type: "web_url",
                                                    url: activity.alternateLink,
                                                    title: `Go to New Activity`,
                                                    webview_height_ratio: "full",
                                                }, {
                                                    type: "postback",
                                                    title: `Set Reminder`,
                                                    webview_height_ratio: "full",
                                                    payload: "set_reminder"
                                                },
                                                {
                                                    type: "postback",
                                                    title: `Return to Menu`,
                                                    webview_height_ratio: "full",
                                                    payload: "menu"
                                                },
                                            ],
                                        },
                                    },
                                };


                                console.log(`New activity in course "${course.name}": ${activity.title}`);
                                console.log(`Activity link: https://classroom.google.com/c/${course.id}/a/${activity.id}`);
                                console.log('LNK: ' + activityLink)
                                await callSendAPI(await sender_psid, await response)
                            } else if (!latestActivityTime) {
                                console.log(`Latest activity in course "${course.name}": ${activity.title}`);
                                console.log(`Activity link: https://classroom.google.com/c/${course.id}/a/${activity.id}`);
                                //console.log('LNK: ' + activityLink);
                            }

                            latestActivityTimeByCourseId[courseId] = activityTime;
                        }
                    } else {
                        console.log("No Work")
                    }
                } catch (err) {
                    console.error(`Error retrieving activity changes for course ${course.name}: ${err}`);

                }
            }
        }


        setInterval(() => checkForActivityChanges(this.sender_psid), 2000); // Check for activity changes every 30 seconds


    }


    async listenCourseChange() {
        const auth = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        );

        auth.setCredentials({
            // Replace the following with your own values
            access_token: this.token.access_token,
            refresh_token: this.token.refresh_token
        });

        const classroom = google.classroom({
            version: 'v1',
            auth: auth
        });

        let courses = [];
        let firstTime = true;

        console.log('scanning...')

        setInterval(() => {
            classroom.courses.list({
                courseStates: ['ACTIVE']
            }, (err, res) => {
                if (err) {
                    console.error(err);
                    return;
                }

                const currentCourses = res.data.courses;

                // Check for new added courses
                if (currentCourses) {
                    if (!firstTime) {
                        const newCourses = currentCourses.filter((course) => {
                            return !courses.some((c) => c.id === course.id);
                        });
                        newCourses.forEach(async (course) => {


                            const response = {
                                attachment: {
                                    type: "template",
                                    payload: {
                                        template_type: "button",
                                        text: `New course added\n'${course.name}'`,
                                        buttons: [
                                            {
                                                type: "web_url",
                                                url: course.alternateLink,
                                                title: `Go to New Course`,
                                                webview_height_ratio: "full",
                                            },
                                        ],
                                    },
                                },
                            };

                            console.log(`New course added: ${course.name}`);
                            await callSendAPI(this.sender_psid, response)
                        });
                    }
                }

                // Check for removed courses
                const removedCourses = courses.filter((course) => {
                    return !currentCourses.some((c) => c.id === course.id);
                });
                removedCourses.forEach(async (course) => {
                    console.log(`Course removed: ${course.name}`);
                    await callSendAPI(this.sender_psid, { text: 'Course removed: ' + course.name });
                });

                // Update courses list
                courses = currentCourses;

                if (firstTime) {
                    firstTime = false;
                }
            });
        }, 2000);
    }

    async hasWorkBeenSubmitted(courseId, courseWorkId, userId, auth) {
        const res = await classroom.courses.courseWork.studentSubmissions.list({
            auth: auth,
            courseId: courseId,
            courseWorkId: courseWorkId,
            userId: userId
        });

        // Check if the list of submissions is not empty
        return res.data.studentSubmissions.length > 0;
    }

    async getCourseWorks(token, courseId) {
        const oauth2Client = new OAuth2Client(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        )

        oauth2Client.setCredentials({
            access_token: token.access_token,
            refresh_token: token.refresh_token
        });

        const classroom = google.classroom({
            version: "v1",
            auth: oauth2Client,
        });

        return new Promise(async (resolve, reject) => {
            classroom.courses.courseWork.list({
                auth: oauth2Client,
                courseId: courseId
            }, async (err, res) => {
                if (err) {
                    reject(err)
                }

                const courseWorks = await res.data.courseWork;

                resolve(await courseWorks);
            });
        })
    }



    async getCourses(token) {

        const oauth2Client = new OAuth2Client(
            CLIENT_ID,
            CLIENT_SECRET,
            REDIRECT_URI
        )

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
            });
        })


    }

}


async function getUsers() {
    db.once('open', async () => {
        const users = await db.collection('noteyfi_users').find().toArray((err, res) => res);

        users.forEach(user => {
            new CourseListener(user).listenCourseChange();
            new CourseListener(user).pushNotification();
        })
    })
}

getUsers();

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

