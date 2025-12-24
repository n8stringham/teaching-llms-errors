var currentQuestionIndex = 0; // Index to keep track of the current question
var answeredQuestions = currentQuestionIndex;
var totalQuestions = null;
let personErrorAnswers = [];
let personErrorAnswersInt = [];
let personActionAnswers = [];
// Did the user make their decision based on a guideline yes/no
let usedGuidelines = [];
// The confidence level the user had for how well the selected error guideline applies
let freeResponseExplanation = [];

// array of ints representing correct answer choices to the question
let correctAnswers = [];
//  array of 0/1 depending on whether ai was wrong/correct
let aiCorrect = [];
let correctRely = [];
let correctRelyInt = [];
let questionTimes = [];
let aiClicked = [];
let guideClicked = [];
let operatorQs = [];

var questionStrings = [];

let globalRegions = null;
let globalRecs = null; 
let globalStats = null
var exampleCounts = [];

let questionsToCheck = null;
let freeResponseObj = null;
let selectedValues = {}
const disabledGroups = new Set(); // Stores IDs of disabled groups


const firebaseConfig = {


//ADD CONFIG
  
  };
  
// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics(app);
const db = firebase.firestore();

// local storage
var response_id;
var task_id;
var exp_condition;

// start and end time for each q
var startTimeQ;
var endTimeQ;
var timeSpentQ;

// click trackers
var aiClick;
var guideClick;

// Function to log page entry time
function logPageEntryTime() {
    startTimeQ = performance.now(); // Record the current time
}

// Function to log page exit time and calculate time spent
function logPageExitTime() {
    endTimeQ = performance.now(); // Record the current time
    timeSpentQ = endTimeQ - startTimeQ; // Calculate time spent on page
}


function showlocalstorage() {
    console.log('response_id=', response_id);
    console.log('task_id=', task_id);
}
function loadlocalstorage() {
    var myData = localStorage["objectToPass"];
    myData = JSON.parse(myData);
    response_id = myData[0];
    task_id = myData[1];
    exp_condition = myData[2];
    onboarding_setting = myData[3];
    showlocalstorage();
}

// local storage
loadlocalstorage()
// Call the updateProgressBar function to initialize the progress bar
updateProgressBar();

function boldString(string, boldPart) {
    let stringWithBold = string.replace(boldPart, `<strong>${boldPart}</strong>`);
    // console.log('bold', stringWithBold)
    return stringWithBold
}

// Split the string on the <br> tag
function process_region_str(str) {
    var lines = str.split('<br>');
    return lines
}
function sampleTeachingQs(arr) {
    // Check if the array has at least one element
    if (arr.length < 1) {
      console.error('Array should have at least one element.');
      return [];
    }

    var newArrAnswers = []
    var newArr = []
    arr.forEach(function(elm, index) {
        // Choose the last element - this is skipped in guidelines so it hasn't been seen before
        const ex_index = (arr.length - 1)
        newArr.push(elm[ex_index])
        newArrAnswers.push(index)
        //  populate the question_names in the original order
        questionStrings.push(elm[ex_index])
    })
    return {questions: newArr, answers: newArrAnswers}
}

function combineLists(l1, l2) {
    return [...l1, ...l2]; 
}

function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function shuffleArray(seed, array) {
    if (array.length === 0) return [];

    // Generate an array of indices and shuffle it using seeded RNG
    const length = array.length;
    const indices = Array.from({ length }, (_, i) => i);
    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(seed + i) * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Apply the shuffled indices to the array
    return indices.map(i => array[i]);
}


// const [shuffledA, shuffledB, shuffledC] = shuffleArrays(a, b, c);
// console.log(shuffledA, shuffledB, shuffledC);

function getQuestions() {
    // Return a promise to handle asynchronous operations
    return new Promise((resolve, reject) => {
        // Grab the mmlu json file
        // $.getJSON('../../mmlu_study.json', function(data) {
        // Old code worked directly with JSON, so here we convert it to avoid rewriting all code
        // ###########################################################
        // Should refactor this later
        // db.collection("tasks_mmlu_cleaned")
        db.collection("tasks_mmlu_cleaned_unmatchedQs")
            .get()
            .then((querySnapshot) => {
                const collectionData = {};
            querySnapshot.forEach((doc) => {
                collectionData[doc.id] = doc.data();
            })
            const data = JSON.parse(JSON.stringify(collectionData))

            // use the withairec questions so that we can check if they selected the correct guideline?
            // we combine the original questions with the hard questions.
            const questions_no_guideline = data[task_id].questions_no_guideline.slice(-3)
            const initQuestions = combineLists(questions_no_guideline, data[task_id].testing_withairec_images.slice(0,3))
            
            totalQuestions = initQuestions.length
            
            // for questions that don't match any guideline the region recommendation is just an empty string
            const initGlobalRegions = combineLists(Array(questions_no_guideline.length).fill(""), JSON.parse(data[task_id].teaching_ours_region_images).slice(0,3));
            
            // const ai_answers = data[task_id].teaching_ours_ai_answers;
            const initAiAnswerLetter= combineLists(Array(questions_no_guideline.length).fill(-1), data[task_id].testing_withairec_ai_answers_raw.slice(0,3));
            
            const initGoldLabel = combineLists(Array(questions_no_guideline.length).fill(-1), data[task_id].testing_withairec_labels.slice(0,3));
            
            // new array which records whether ai was correct or not
            const initAiCorrect = initAiAnswerLetter.map((value, index) => value === -1 ? -1 : (value === initGoldLabel[index] ? 1 : 0));
            
            const initCorrectRely = combineLists(Array(questions_no_guideline.length).fill(""), data[task_id].testing_withairec_ai_recommendations.slice(0,3));
            
            const initCorrectRelyInt = initCorrectRely.map(item => 
                item === "" ? 2 : (item.includes("Recommendation: Ignore AI Answer") ? 0 : 1)
            );

            const initGlobalRecs = combineLists(Array(questions_no_guideline.length).fill(""), data[task_id].teaching_ours_recs.slice(0,3));
            const initGlobalStats = combineLists(Array(questions_no_guideline.length).fill(""),data[task_id].teaching_ours_stats.slice(0,3));
            
            // console.log('BEFORE SHUFFLE')
            // console.log('questions', initQuestions)
            // console.log('totalQuestions', totalQuestions)
            // console.log('globalRegions', )
            // console.log('ai_answer_letter', initAiAnswerLetter)
            // console.log('goldLabel', initGoldLabel)
            // console.log('aiCorrect', initAiCorrect)
            // console.log('correctRely', initCorrectRely)
            // console.log('correctRelyInt', initCorrectRelyInt)
            // console.log('globalRegions', initGlobalRegions)
            // console.log("globalRecs",initGlobalRecs)
            // console.log("globalStats", initGlobalStats)

            // shuffle questions, globalRegions, ai_answer_letter, goldLabel, correctRely, correctRelyInt
            // const [questions] = shuffleArrays(47, initQuestions)
            const questions = shuffleArray(47, initQuestions)
            const aiAnswerLetter = shuffleArray(47, initAiAnswerLetter)
            const goldLabel = shuffleArray(47, initGoldLabel)
            
            // global
            aiCorrect = shuffleArray(47, initAiCorrect)
            correctRely = shuffleArray(47, initCorrectRely)
            correctRelyInt = shuffleArray(47, initCorrectRelyInt)
            globalRegions = shuffleArray(47, initGlobalRegions)
            globalRecs = shuffleArray(47, initGlobalRecs)
            globalStats = shuffleArray(47, initGlobalStats)

            // console.log('AFTER SHUFFLE')
            // console.log('questions', questions)
            // console.log('totalQuestions', totalQuestions)
            // console.log('ai_answer_letter', aiAnswerLetter)
            // console.log('goldLabel', goldLabel)
            // console.log('aiCorrect', aiCorrect)
            // console.log('correctRely', correctRely)
            // console.log('correctRelyInt', correctRelyInt)
            // console.log('globalRegions', globalRegions)
            // console.log("globalRecs",globalRecs)
            // console.log("globalStats", globalStats)
            

            // Issue is that their data seems to be bad, the onboarding guideline isn't associated with the test
            // questions. So we can check if the recommendation was to rely or not, but not if the actual rule is
            // was matched correctly.

            // Using the withai subset
            // const questions = data[task_id].testing_withai_images;
            // const ai_answers = data[task_id].testing_withai_ai_answers;
            // const ai_answer_letter = data[task_id].testing_withai_ai_answers_raw;
            // console.log('ai_answer_letter', ai_answer_letter)
            // const goldLabel = data[task_id].testing_withai_label;
            // console.log('goldLabel', goldLabel)
            // // new array which records whether ai was correct or not
            // aiCorrect = ai_answer_letter.map((value, index) => value === goldLabel[index] ? 1 : 0);
            // console.log('aiCorrect', aiCorrect)

            
            // const region_rec = data[task_id].testing_withairec_ai_recommendations
            // console.log('region_rec', region_rec)

            // Create a list of formatted questions - each question appears twice in the list so that 
            // it is answered in two stages
            const formattedQuestions = questions.map((text, idx) => {
                const formattedQuestion = {
                    text: parseQuestionString(text).q,
                    // aiRecommendation: parseAIString(ai_answers[idx]),
                    // aiLetter: ai_answer_letter[idx],
                    options: parseQuestionString(text).options,
                    correctAnswer: goldLabel[idx]
                };

                // Return the question twice
                return formattedQuestion
            })
            // Log the formatted questions (for testing)
            // console.log(formattedQuestions);

            // Log the formatted questions (for testing)
            // console.log(formattedQuestions);

            // Resolve the promise with the formatted questions
            resolve(formattedQuestions);
        })
        // .fail(function(error) {
        .catch((error) => {
            // Reject the promise with an error if there is any
            reject(error);
        });
    });
}

function parseAIString(aiString) {
    // Split the question string into an array of lines
    const lines = aiString.split('<br>');

    // Initialize an object to store the options
    
    const letterPred = boldString(lines[0], 'AI Predicts:');
    // const  expl = lines[1].slice(12);
    const  expl = boldString(lines[1], 'Answer:');
    return letterPred + '<br>' + expl;
}


function parseQuestionString(questionString) {
    // Split the question string into an array of lines
    const lines = questionString.split('<br>');

    // Initialize an object to store the options
    const options = [];
    const q = boldString(lines[0], 'Question:')

    // Iterate through the lines starting from index 1 (index 0 contains the question)
    for (let i = 1; i < lines.length; i++) {
        // Extract the option key (A, B, C, D)
        const optionKey = lines[i].charAt(0);

        // Extract the option value by removing the option key and leading whitespace
        const optionValue = lines[i].slice(2).trim();

        // Add the option to the object
        // options[optionKey] = optionValue;
        // options.push(optionValue)
        // options.push(optionKey)
        options.push(boldString(lines[i], optionKey))
    }

    return {q, options};
}

function showQuestions() {
    // start time
    logPageEntryTime()
    // Disable the "Show Questions" button
    document.getElementById("show-questions").disabled = true;
    // Usage of the getQuestions function
    getQuestions()
    .then(function(formattedQuestions) {
        questions = formattedQuestions

        // const ai_answers = data.tasks.task_0exp_condition_2.testing_withai_ai_answers;
        ai_pred = questions[currentQuestionIndex].aiRecommendation
        
        // Logic to display questions
        // Update the question text, AI recommendation, and options based on the currentQuestionIndex
        document.getElementById("question-text").innerHTML = questions[currentQuestionIndex].text;
        
        // Spell out the options for the question
        document.getElementById("labelA").innerHTML = questions[currentQuestionIndex].options[0];
        document.getElementById("labelB").innerHTML = questions[currentQuestionIndex].options[1];
        document.getElementById("labelC").innerHTML = questions[currentQuestionIndex].options[2];
        document.getElementById("labelD").innerHTML = questions[currentQuestionIndex].options[3];
        
        // Create the sidebar content (AI Prediction)//
        // Select the sidebar content div
        var sidebarContent = $('#sidebarContent');

        // Create a list group element
        var pred = $('<ul>', {
            class: 'list-group'
        });
        var listItem = $('<li>', {
            class: 'list-group-item mb-2',
            // id: 'Region' + index,
            html: ai_pred
        });
        pred.append(listItem)

        // Append the list group to the sidebar content
        sidebarContent.html(pred);

        // Show the quiz-container
        container = document.getElementById("quiz-container")
        container.style.display = "block";
        // Scroll to it
        container.scrollIntoView({ behavior: "smooth", block: "end" });
        
        })

    .catch(function(error) {
        // Handle errors if any
        console.error(error);
    });
}

// AI prediction sidebar
function expandSidebarWithDelay() {
    // Show the spinner while loading
    $('#loadingSpinner').show();

    setTimeout(function () {
        // Your existing logic to expand the sidebar content
        $('#sidebarContent').collapse('show');

        // Hide the spinner when content is ready
        $('#loadingSpinner').hide();
    }, 1000); // Adjust the delay time in milliseconds
}

// AI prediction sidebar
function toggleSidebar() {
    var sidebarContent = $('#sidebarContent');
    // var loadingSpinner = $('#loadingSpinner');
    var aiButton = $('#aiButton');

    var shownSpinner = '<span id="loadingSpinner" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' + 
    ' Computing...'

    // If the content is showing then we hide it
    if (sidebarContent.hasClass('show')) {
        sidebarContent.collapse('hide');
        aiButton.html('Show')
    } else {
        // Show the spinner
        aiButton.html(shownSpinner)
        //  Delay
        setTimeout(function () {
        sidebarContent.collapse('show');
        // loadingSpinner.hide()
        aiButton.html('Hide')
    }, 1000); // Adjust the delay time in milliseconds
    
    // Track that AI button was clicked and prediction revealed
    aiClick = 1
    }
}

// Shows all of the regions in a sidebar
// function createGuideList(recs, stats) {
//     // Select the sidebar content div
//     var sidebarContent = $('#guideContent');

//     sidebarContent.empty();  // This clears the current content

//     // Create a list group element
//     var listGroup = $('<ul>', {
//         class: 'list-group'
//     });

//     // <input type="hidden" name="likelihood" value=""></input>
//     var hiddenInput = $('<input>', {
//         type: "hidden",
//         name: "guideline",
//         value: ""
//     })

//     // option to select None from Guidelines
//     var noneItem = $('<button>', {
//         // type: "card",
//         class: 'list-group-item list-group-item-action mb-3',
//         id: 'noneItem',
//         html: `<h5>None Apply</h5>`
//     });
//     listGroup.append([hiddenInput,noneItem]);

//     // Iterate over each tile name and create a list item
//     recs.forEach(function (tileName, index) {
//         // console.log('tileName=',tileName)
//         // console.log('tilenameIndex', index)
//         const proc_str = process_region_str(tileName)
//         const proc_stats = process_region_str(stats[index])


//         var listItem = $('<button>', {
//             // type: "card",
//             class: 'list-group-item list-group-item-action mb-3',
//             id: 'Region' + index,
//             html: `<h5>${proc_str[1]}</h5>`,
//             // html: `<h5>${proc_str[1]}</h5>` +  boldString(proc_stats[1], 'AI Accuracy') +  boldString(proc_stats[2], 'Human Accuracy'),
//         });
//         // Add data-group custom attribute
//         listItem.attr('data-group', 'group3');

//         // Append the list item to the list group
//         listGroup.append(listItem);
//     });

//     // Append the list group to the sidebar content
//     sidebarContent.append(listGroup);
// }
        
function writeUserData() {
    // get the appropriate response doc
    db.collection("responses_mmlu" + onboarding_setting)
      .doc(response_id)
      .update({ 
        test_user_answers_str: personErrorAnswers,
        test_user_answers_int: personErrorAnswersInt,
        test_user_answers_action: personActionAnswers,
        test_used_guideline: usedGuidelines,
        test_free_response: freeResponseExplanation,
        // array which records the recommended behavior ignore/rely/unsure ai per question
        test_recs : correctRely, 
        // mapped to ints 0, 1, 2
        test_recs_int: correctRelyInt,
        // array which records whether ai was correct or not
        test_ai_correct: aiCorrect,
        test_time_per_q: questionTimes,
        operator_q: operatorQs

      })
      .then(() => {
        console.log("Response successfully written!");
        // reset the click variables
        aiClick = 0;
        guideClick = 0;
      })
      .catch((error) => {
        console.error("Error writing response: ", error);
      });
  }

document.addEventListener("DOMContentLoaded", function () {
    // Ensure no items are active before we start
    document.querySelectorAll(".list-group-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".list-group input[type=hidden]").forEach(input => input.value = "");

    // Hide details container initially
    const detailsContainer = document.getElementById("details-container");
    const followUpContainer = document.getElementById("follow-up-qs");
    const regularFollowUp = document.getElementById("regular-follow-up")
    const uncertainFollowUp = document.getElementById("uncertain-follow-up")
    const freeResponseContainer = document.querySelector("#free-response-container");
    const mainQ = document.querySelector('#options-form');
    const freeResponseUncertain = document.querySelector('#free-response-uncertain')
    const freeResponseReg = document.querySelector('#free-response-reg')
    const operatorQ = document.querySelector('#operator-form')
    detailsContainer.style.display = "none";
    followUpContainer.style.display = "none";
    regularFollowUp.style.display = "none";
    uncertainFollowUp.style.display = "none";
    freeResponseContainer.style.display = "none";
    freeResponseUncertain.value = "";
    freeResponseReg.value = "";


    // What happens when we click on one of the answer options for the operator question
    operatorQ.addEventListener("click", function (event) {
        const clickedButton = event.target.closest(".list-group-item"); // Get the clicked button
        // If clickedButton is null, return early to prevent errors
        if (!clickedButton) return;

        const hiddenInput = operatorQ.querySelector("input[name='operator-likelihood']");
        const group = clickedButton.closest(".list-group");

        if (!clickedButton || disabledGroups.has(group.id)) return; // Ignore clicks outside the buttons

        const items = group.querySelectorAll(".list-group-item");

        // Toggle selection state
        if (clickedButton.classList.contains("active")) {
            clickedButton.classList.remove("active");
            hiddenInput.value = "";
            selectedValues[hiddenInput.name] = "";
            followUpContainer.style.display = "none";
        } else {
            items.forEach(i => i.classList.remove("active"));
            clickedButton.classList.add("active");
            hiddenInput.value = clickedButton.id;
            selectedValues[hiddenInput.name] = hiddenInput.value;
            console.log('selected', selectedValues)
        }

        console.log("Hidden input updated to:", hiddenInput.value); // Debugging
    });


    // What happens when we click on one of the answer options for the first question
    mainQ.addEventListener("click", function (event) {
        const clickedButton = event.target.closest(".list-group-item"); // Get the clicked button

        // If clickedButton is null, return early to prevent errors
        if (!clickedButton) return;

        const hiddenInput = mainQ.querySelector("input[name='error-likelihood']");
        const group = clickedButton.closest(".list-group");

        if (!clickedButton || disabledGroups.has(group.id)) return; // Ignore clicks outside the buttons

        const items = group.querySelectorAll(".list-group-item");

        // Toggle selection state
        if (clickedButton.classList.contains("active")) {
            clickedButton.classList.remove("active");
            hiddenInput.value = "";
            selectedValues[hiddenInput.name] = "";
            followUpContainer.style.display = "none";
        } else {
            items.forEach(i => i.classList.remove("active"));
            clickedButton.classList.add("active");
            hiddenInput.value = clickedButton.id;
            selectedValues[hiddenInput.name] = hiddenInput.value;
            followUpContainer.style.display = "block";

            // Show or hide the appropriate container based on selection
            if (hiddenInput.value === "likely wrong" || hiddenInput.value === "likely correct") {
                regularFollowUp.style.display = "block";
                uncertainFollowUp.style.display = "none";
            } else {
                uncertainFollowUp.style.display = "block";
                regularFollowUp.style.display = "none";
            }

            followUpContainer.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        console.log("Hidden input updated to:", hiddenInput.value); // Debugging
    });

    // What happens when we click on one of the answer options for regularFollowUp
    regularFollowUp.addEventListener("click", function (event) {
        const clickedButton = event.target.closest(".list-group-item"); // Get the clicked button

        // If clickedButton is null, return early to prevent errors
        if (!clickedButton) return;

        const hiddenInput = uncertainFollowUp.querySelector("input[name='used-guideline']");
        const group = clickedButton.closest(".list-group");

        if (!clickedButton || disabledGroups.has(group.id)) return; // Ignore clicks outside the buttons

        const items = group.querySelectorAll(".list-group-item");

        // Toggle selection state
        if (clickedButton.classList.contains("active")) {
            clickedButton.classList.remove("active");
            hiddenInput.value = "";
            selectedValues[hiddenInput.name] = "";
        } else {
            items.forEach(i => i.classList.remove("active"));
            clickedButton.classList.add("active");
            hiddenInput.value = clickedButton.id;
            selectedValues[hiddenInput.name] = hiddenInput.value;
        }

        console.log("Hidden input updated to:", hiddenInput.value); // Debugging

        freeResponseContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    uncertainFollowUp.addEventListener("click", function (event) {
        const clickedButton = event.target.closest(".list-group-item"); // Get the clicked button
        if (!clickedButton) return; // Exit if no button is clicked
    
        const hiddenInput = uncertainFollowUp.querySelector("input[name='used-guideline']");
        const group = clickedButton.closest(".list-group");
        if (disabledGroups.has(group.id)) return; // Ignore clicks outside the buttons
    
        const items = group.querySelectorAll(".list-group-item");
    
        // If already active, unhighlight and clear value
        if (clickedButton.classList.contains("active")) {
            clickedButton.classList.remove("active");
            hiddenInput.value = "";
            selectedValues[hiddenInput.name] = ""; // Also clear selectedValues
            console.log("Hidden input cleared");
        } else {
            // Highlight the clicked button and update value
            items.forEach(i => i.classList.remove("active"));
            clickedButton.classList.add("active");
            hiddenInput.value = clickedButton.id;
            selectedValues[hiddenInput.name] = hiddenInput.value;
            console.log("Hidden input updated to:", hiddenInput.value);
        }
    
        // Toggle freeResponseContainer visibility
        if (hiddenInput.value === "partial-guideline") {
            freeResponseContainer.style.display = "block";
        } else {
            document.querySelector("#free-response-uncertain").value = "";
            freeResponseContainer.style.display = "none";
        }
    
        freeResponseContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // Functions to disable/enable specific list groups
    function disableSelectionForGroup(groupId) {
        disabledGroups.add(groupId);
    }

    function enableSelectionForGroup(groupId) {
        disabledGroups.delete(groupId);
    }

    // Submit Button
    document.querySelector("#followUpButton").addEventListener("click", function () {
        console.log('selectedValues', selectedValues)
        if (selectedValues['error-likelihood'] === "uncertain"){
            freeResponseObj = document.querySelector("#free-response-uncertain")
        } else {
            freeResponseObj = document.querySelector("#free-response-reg")
        }
        // store the value from the free-response box
        console.log('fr', freeResponseObj)
        let freeResponseFilled = false;
        let freeResponseValue = freeResponseObj.value.trim();
        selectedValues[freeResponseObj.name] = freeResponseValue
        console.log("freeResponseValue", freeResponseValue)

        let usedGuidelineFilled = false
        let allSelected = false; // Flag to check if all follow-up questions are answered
        
        // FreeResponseValue must not be empty unless 'used-guideline-uncertain' = 'no-guideline' or 'forgot'
        if (freeResponseValue !== "" || selectedValues['used-guideline'] == "no-guideline" || selectedValues['used-guideline'] == "forgot") {
            freeResponseFilled = true;
        }
        // used guideline should not be empty
        if (selectedValues['used-guideline'] && selectedValues['used-guideline'].trim() !== "") {
            usedGuidelineFilled = true;
        }
        console.log(usedGuidelineFilled, freeResponseFilled)
        console.log(selectedValues)

        // All questions should be filled
        allSelected = usedGuidelineFilled && freeResponseFilled


        if (!allSelected) {
            alert("Please fill out all follow-up questions before proceeding.");
            return;
        }
    
        console.log("All follow-up questions are answered. Proceeding to feedback...");
        
        // disable followUpSubmit
        // console.log('qtc.name',questionsToCheck.name)
        // console.log('qtc.name',questionsToCheck.id)
        disableSelectionForGroup(regularFollowUp.id + "-lg")
        disableSelectionForGroup(uncertainFollowUp.id + "-lg")
        disableSelectionForGroup("mainQ")
        disableSelectionForGroup("operatorQ")
        freeResponseObj.disabled = true;
        followUpButton.disabled = true;
        // Show details container
        detailsContainer.style.display = "block";
        detailsContainer.scrollIntoView({ behavior: "smooth", block: "start" });

        // Disable and hide the submit button
        // submitButton.disabled = true;
        // submitButton.style.display = "none";
        console.log('gr', globalRegions)
        let regionData = globalRegions[answeredQuestions]
        console.log('regionData', regionData)
        // console.log('globalRecs', globalRecs)
        // console.log('globalStats', globalStats)


        // Did user select correct option?
        // let userAnswer = errorLikelihoodMap[selectedValues['error-likelihood']]
        // let userAnswerString = selectedValues['error-likelihood']
        // let cLabel = correctRelyInt[currentQuestionIndex]
        // console.log('correctRelyInt', correctRelyInt)
        // console.log('currentQuestionIndex', currentQuestionIndex)
        // console.log('cLabel', cLabel)


        // function checkUserCorrect(userAnswer, label) {
        //     return (userAnswer == label) ? 1 : 0;
        // }

        // userCorrect = checkUserCorrect(userAnswer, cLabel)
        // console.log('userAnswer', userAnswer)
        // console.log('cLabel', cLabel)
        // console.log('userCorrect', userCorrect)

        // function generateFeedback(userCorrect, userX, aiX) {
        //     if (userCorrect === 1 && cLabel !== 2) {
        //         return `You were Correct! <br> You answered "${userX}" and the example above is similar to questions where AI is typically ${aiX}. <br> Please review the details below.`;
        //     } else if (userCorrect === 1 && cLabel === 2) { 
        //         return `You were Correct! <br> You answered "${userX}" and the example above does not match any of the guidelines.`;
        //     } else if (userCorrect === 0 && cLabel === 2) {
        //         return `Oops, that's not right! <br> You answered "${userX}" but the example above actually does not match any of the guidelines. You should have answered "I am uncertain".`;
        //     } else {
        //         return `Oops, that's not right! <br> You answered "${userX}", but the example above is similar to questions where AI is typically ${aiX}. <br> Please review the details below.`;
        //     }
        // }

        // let feedback = generateFeedback(userCorrect, userAnswerStringMap[userAnswerString], recMap[cLabel])
        

        // Populate details card
        // if (cLabel === 2) {
        //     populateDetailsCard(regionData, globalRecs, globalStats, answeredQuestions, feedback, true)
        // } else {
        //     populateDetailsCard(regionData, globalRecs, globalStats, answeredQuestions, feedback)
        // }

        // Create the "Next Question" button if it doesn't already exist
        let nextButton = document.getElementById("nextQuestionButton");
        if (!nextButton) {
            nextButton = document.createElement("button");
            nextButton.id = "nextQuestionButton";
            nextButton.textContent = "Next Question";
            nextButton.className = "btn btn-primary mt-3 d-block mx-auto"; // Bootstrap styling
            nextButton.addEventListener("click", function () {
                detailsContainer.style.display = "none"; // Hide details container
                // submitButton.disabled = false; // Re-enable submit button
                // submitButton.style.display = "block"; // Show submit button
                followUpContainer.style.display = "none"
                followUpButton.disabled = false
                regularFollowUp.style.display = "none";
                uncertainFollowUp.style.display = "none";
                enableSelectionForGroup('mainQ')
                enableSelectionForGroup('regular-follow-up-lg')
                enableSelectionForGroup('uncertain-follow-up-lg')
                enableSelectionForGroup('operatorQ')
                freeResponseObj.disabled = false;
                moveToNextQuestion(); // Move to the next question
            });
            detailsContainer.appendChild(nextButton);
            detailsContainer.scrollIntoView({ behavior: "smooth", block: "end" });
        }

        // Submission logic
        console.log("Selected values:", selectedValues);
        logPageExitTime();

        // User answer I would not, I would, I'm uncertain
        personErrorAnswers.push(selectedValues['error-likelihood'])
        personActionAnswers.push(errorLikelihood2action[selectedValues['error-likelihood']])
        // User answer mapped to int 0, 1, 2
        personErrorAnswersInt.push(errorLikelihoodMap[selectedValues['error-likelihood']]);
        // User answer did they use guideline (yes/no) || User answer why uncertain (guideline partially applies, guideline doesn't apply, forgot guidelines)
        usedGuidelines.push(selectedValues['used-guideline']);
        // User answer free response (When user answers that guideline doesn't apply or they forgot, this is "")
        freeResponseExplanation.push(selectedValues['free-response']);
        // Time spent on each Question
        questionTimes.push(timeSpentQ);
        // Distractor OperatorQ - humans should answer no while operator might answer yes
        operatorQs.push(selectedValues['operator-likelihood'])


        // Check if the users selection was wrong or correct
        // personErrorAnswer

        console.log(personErrorAnswers);
        console.log(personErrorAnswersInt);
        console.log(usedGuidelines);
        console.log(freeResponseExplanation);
        console.log(questionTimes);

        writeUserData();
    });

    function moveToNextQuestion() {
        currentQuestionIndex++;

        if (currentQuestionIndex < totalQuestions) {
            answeredQuestions++;
            updateProgressBar();
            // Clear out the responses
            document.querySelectorAll(".list-group-item.active").forEach(item => item.classList.remove("active"));
            document.querySelectorAll(".list-group input[type=hidden]").forEach(input => input.value = "");
            document.querySelector("#free-response-reg").value = "";
            document.querySelector("#free-response-uncertain").value = "";
            showQuestions();
        } else {
            logTimeSpent();
        }
    }
});

function boldQandA(string) {
    let split_str = process_region_str(string)
    let q = boldString(split_str[0], 'Question:')
    let a = boldString(split_str[1], 'A:')
    let b = boldString(split_str[2], 'B:')
    let c = boldString(split_str[3], 'C:')
    let d = boldString(split_str[4], 'D:')

    return q + '<br>' + a + '<br>' + b + '<br>' + c + '<br>' + d
}

// // Function to populate details card with JSON data
// function populateDetailsCard(region, rec, stats, regionNum, feedback, feedbackOnly=false) {
//     console.log('regionNum', regionNum)
//     carouselNum = regionNum;
//     const proc_str = process_region_str(rec[regionNum]);
//     const proc_stats = process_region_str(stats[regionNum]);
//     let rec_str = proc_str[0].includes("Rely") 
//     ? "For instances like these, AI is typically but not always CORRECT" 
//     : "For instances like these, AI is typically but not always WRONG";
//     const region_descr_str = '<h4>' + proc_str[1] + '</h4>';
//     const region_rec_str = '<h4>' + rec_str + '</h4>';
//     const msg = '<h3>' + feedback + '</h3>'

//     $("#details-msg").html(msg);

//     if (feedbackOnly) {
//         // Hide details and carousel
//         $("#details-rec").hide();
//         $("#details-content").hide();
//         $("#details-example").hide();
//         $("#regionCarousel").hide();
//         $("#buttonNext").hide();
//         $("#buttonPrev").hide();
//         $(".col-md-12.mt-4").hide();
//         return;  // Exit early since we don't want to populate anything else
//     } else {
//         // Show elements when they should be visible
//         $("#details-rec").show();
//         $("#details-content").show();
//         $("#details-example").show();
//         $("#regionCarousel").show();
//         $("#buttonNext").show();
//         $("#buttonPrev").show();
//         $(".col-md-12.mt-4").show();
        
//     }

//     $("#details-rec").html(region_descr_str + '<br>' + region_rec_str + '<br>' + '<h5>Accuracies</h5>' + proc_stats[1] + '<br>' + proc_stats[2]);

//     // Remove any existing green/red tile classes
//     $("#details-rec").removeClass('green-tile red-tile');

//     // Add a class based on the condition
//     // if (proc_str[0].includes('Rely')) {
//     //     // $("#details-rec").addClass('green-tile').append($('<span>', { class: "marker", text: "\u2714" }));
//     //     $("#details-rec").addClass('green-tile').append($('<span>', { class: "marker"}));
//     // } else {
//     //     // $("#details-rec").addClass('red-tile').append($('<span>', { class: "marker", text: "\u2718" }));
//     //     $("#details-rec").addClass('red-tile').append($('<span>', { class: "marker"}));
//     // }

//     $("#details-content").html('<h4 class="text-center">Explore Specific Examples</h4>');

//     let carouselItems = '';
//     const default_active = regionNum === 5 ? 0 : 1;

//     // Iterate through the region array and create carousel items
//     region.forEach((regionItem, index) => {
//         if (index !== (region.length - 1)) {
//             carouselItems += `
//             <div class="carousel-item ${index === default_active ? 'active' : ''}">
//                 <div class="card-body">${boldQandA(regionItem)}</div>
//             </div>
//         `;
//         }
//     });

//     // Create the carousel structure
//     const carousel = `
//     <div class="card-body">
//         <div id="regionCarousel" class="carousel slide" data-ride="carousel">
//             <div class="carousel-inner">
//                 ${carouselItems}
//             </div>
//             <div class="progress mt-3">
//                 <div class="progress-bar" role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
//             </div>
//         </div>
//     </div>`;

//     $("#details-example").html(carousel);

//     // Initialize the carousel with manual controls
//     $('#regionCarousel').carousel({ interval: false });

//     // Add event listener to update progress bar on slide change
//     $('#regionCarousel').on('slide.bs.carousel', function (event) {
//         var totalSlides = $('#regionCarousel .carousel-item').length;
//         var currentSlideIndex = event.to + 1;
//         var progressPercentage = (currentSlideIndex / totalSlides) * 100;
//         $('.progress-bar').css('width', progressPercentage + '%').attr('aria-valuenow', progressPercentage);
//     });
// }

// // Event listeners for next/prev buttons
// $('#buttonNext').on('click', function () { $('#regionCarousel').carousel('next'); exampleCounts[carouselNum]++; });
// $('#buttonPrev').on('click', function () { $('#regionCarousel').carousel('prev'); exampleCounts[carouselNum]++; });


const userAnswerStringMap = {
    'likely wrong': 'I would NOT use AI',
    'uncertain': 'I am uncertain',
    'likely correct': 'I would use AI',
}
const recMap = {
    0 : 'wrong',
    1 : 'correct',
    2 : 'uncertain',
};

const errorLikelihoodMap = {
    'likely wrong': 0,
    'uncertain': 2,
    'likely correct': 1,
};

const errorLikelihood2action = {
    'likely wrong': 'I would not use AI',
    'uncertain': 'I am uncertain',
    'likely correct': 'I would use AI',
};

const confidenceMap = {
    'noneItem': 0,
    'partial': 1,
    'complete': 2,
};


function updateProgressBar() {
    // Update the progress bar based on the answered questions
    var progressPercentage = (answeredQuestions / totalQuestions) * 100;
    $('#quiz-progress').css('width', progressPercentage + '%').attr('aria-valuenow', progressPercentage);
}

function enableBeforeUnload() {
    window.onbeforeunload = function (e) {
      return "Discard changes? Your work will be lost.";
    };
  }

function disableBeforeUnload() {
    window.onbeforeunload = null;
}

enableBeforeUnload()

// Timing
const startTime = performance.now();
// For tracking how long the entire study takes
// const studyStartTime = performance.now()

function updateTotalTime(newTimeSpent) {
    var ts = JSON.parse(localStorage["totalTimeSpent"]);
    ts = ts + newTimeSpent
    // Store the updated value back into local storage
    localStorage.setItem('totalTimeSpent', JSON.stringify(ts));
  }

function logTimeSpent() {
  timeSpent = performance.now() - startTime
  // Log the response
  updateTotalTime(timeSpent)
  writeTimeSpent()
}


function writeTimeSpent() {
  // console.log('response_id=', response_id)
  db.collection("responses_mmlu" + onboarding_setting)
    .doc(response_id)
    .update({
      time_spent_testing: timeSpent,
      study_total_time: localStorage["totalTimeSpent"],
    })
    .then(() => {
      console.log("Response successfully written!");
      disableBeforeUnload()
    //   alert("Quiz completed! Click OK to continue");
      // Redirect to a new page with a thank you message
    //   window.location.href = "test-phase.html"; // Go to End Page
      window.location.href = "finish-page.html"; // Go to End Page
    })
    .catch((error) => {
      console.error("Error writing response: ", error);
    });
}

console.log('tts=', localStorage['totalTimeSpent'])

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
