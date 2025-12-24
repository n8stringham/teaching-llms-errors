// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {

//ADD CONFIG
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics(app);

const db = firebase.firestore();
var authen_token;
var is_valid = false;
var timeSpent;

function nextPage(nextPageUrl) {
  disableBeforeUnload()
  location.href = nextPageUrl;
  }

function enableBeforeUnload() {
  window.onbeforeunload = function (e) {
  return "Discard changes? Your work will be lost.";
};
}

function enableBeforeUnload() {
  window.onbeforeunload = function (e) {
    return "Discard changes? Your work will be lost.";
  };
}

function disableBeforeUnload() {
window.onbeforeunload = null;
}

function showlocalstorage() {
  console.log('response_id=', response_id);
  console.log('task_id=', task_id);
}

var myData = localStorage["objectToPass"];
myData = JSON.parse(myData);

var response_id = myData[0];
var task_id = myData[1];
var exp_condition = myData[2];
var onboarding_setting = myData[3];


// Timing
const startTime = performance.now();
// For tracking how long the entire study takes
const studyStartTime = performance.now()

//  add event listener to the continue button
$('#overview-continue').on('click', logTimeSpent);

function logTimeSpent() {
  timeSpent = performance.now() - startTime
  // Log the time spent
  // console.log('Time spent before clicking Next: ' + timeSpent + ' milliseconds');
  // Log the response
  localStorage.setItem('totalTimeSpent', JSON.stringify(timeSpent));
  writeUserData()
}

function writeUserData() {
  // Remove the event listener after logging the time
  $('#overview-continue').off('click', logTimeSpent);
  // console.log('response_id=', response_id)
  db.collection("responses_mmlu" + onboarding_setting)
    .doc(response_id)
    .update({
      time_spent_overview: timeSpent,
      study_start_time: studyStartTime,
    })
    .then(() => {
      console.log("Response successfully written!");
      nextPage('./guide.html')
    })
    .catch((error) => {
      console.error("Error writing response: ", error);
      //// TEMPORARY HACK FOR TESTING
      nextPage('./guide.html')
    });
}

// Precautions to make it more difficult for crowdworkers to use AI by disabling right click, copy/paste, and screenshots (limited)
document.addEventListener('contextmenu', event => event.preventDefault()); // Disable right-click

document.addEventListener('keydown', event => {
    if (event.ctrlKey && (event.key === 'c' || event.key === 'x' || event.key === 'v')) {
        event.preventDefault(); // Disable Ctrl+C, Ctrl+X, and Ctrl+V
    }
    if (event.metaKey && (event.key === 'c' || event.key === 'x' || event.key === 'v')) {
        event.preventDefault(); // Disable Command+C, Command+X, and Command+V (Mac)
    }
});
// prevent screenshots
// setInterval(() => {
//   if (window.outerWidth - window.innerWidth > 200 || window.outerHeight - window.innerHeight > 200) {
//       document.body.innerHTML = "Dev tools disabled.";
//   }
// }, 1000);

