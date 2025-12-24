const firebaseConfig = {
// ADD Config
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics(app);
const db = firebase.firestore();

var response_id;
var task_id;
var exp_condition;

// track click counts for each region
var clickCounts = [];
var guidelineNames = [];
var clickSeq = [];
var timeSeq = [];
// Track when first guideline is visited
var visited = 0;
var newStartGuideline

// Track how many examples are toggled
var carouselNum;
var exampleCounts = [];

loadlocalstorage()

// Region Analytics will be a local storage object that we update

function showlocalstorage() {
    console.log(response_id);
    console.log(task_id);
  }
function loadlocalstorage() {
    var myData = localStorage["objectToPass"];
    myData = JSON.parse(myData);
    response_id = myData[0];
    task_id = myData[1];
    exp_condition = myData[2];
    onboarding_setting = myData[3];
    // showlocalstorage();
  }

function disableButton(buttonID) {
    // Disable the region showing button
    var btn = $('#' + buttonID);
    btn.hide();
    // document.getElementById(buttonID).disabled = true;
    
  }
function enableButton(buttonID) {
// Disable the region showing button
document.getElementById(buttonID).disabled = false;
}

function nextPage(nextPageUrl) {
    disableBeforeUnload()
    location.href = nextPageUrl;
    }

// Function to automatically construct the appropriate number of tiles
// Parse the json file, count how many regions there are, and make a tile for each
function constructTiles() {
    // Grab the mmlu json file
    // $.getJSON('../../mmlu_study.json', function(data) {
    // Old code worked directly with JSON, so here we convert it to avoid rewriting all code
    // ###########################################################
    // Should refactor this later
    //  Choose which tasks collection to draw from - tasks_mmlu is the neurips original data. "tasks_mmlu_cleaned" is the same data, but with fixed typos and minor asthetic modifications.
    // db.collection("tasks_mmlu")
    // db.collection("tasks_mmlu_cleaned")
    db.collection("tasks_mmlu_cleaned_unmatchedQs")
        .get()
        .then((querySnapshot) => {
            const collectionData = {};
        querySnapshot.forEach((doc) => {
            collectionData[doc.id] = doc.data();
        })
        const data = JSON.parse(JSON.stringify(collectionData))
    // ##########################################################

        // This gets the regions but it's JSON
        const regions = data[task_id].teaching_ours_region_images;
        const recs = data[task_id].teaching_ours_recs;
        const stats = data[task_id].teaching_ours_stats

        // console.log(stats)

        // Create a row element to contain the columns
        var row = $('<div>', {
            class: 'row'
        });
        var rely_col = $('<div>', {
            // class: 'col-md-4 mb-4',
            class: 'col-md-6'
        });
        var ignore_col = $('<div>', {
            // class: 'col-md-4 mb-4',
            class: 'col-md-6',
        });

        // Create a title for "Rely on AI"
        var titleRely = $('<h3>', {
            class: 'column-title text-center mb-4',  // Added text-center and mb-4 classes for centering and margin
            html: '<span class="highlight">AI</span> is typically but not always <br> <span class="highlight">CORRECT</span>',
            // style: 'font-weight: bold;',  // Added style for color and font-weight
        });

        // Create a title for "Ignore AI"
        var titleIgnore = $('<h3>', {
            class: 'column-title text-center mb-4',  // Added text-center and mb-4 classes for centering and margin
            html: '<span class="highlight">AI</span> is typically but not always <br> <span class="highlight">WRONG</span>',
            // style: 'font-weight: bold;',  // Added style for color and font-weight
        });

        // // Append card to column
        rely_col.append(titleRely);
        ignore_col.append(titleIgnore)

        try {
            // Parse the JSON string to an array
            var parsedObject = JSON.parse(regions);

            // Check if parsedObject is an array
            if (Array.isArray(parsedObject)) {

                // Create the sidebar content from the parsedObject
                createSidebarList(recs, stats)

                // Select the container where tiles will be appended
                var container = $('#tiles-container');
                // Clear the container before appending new elements
                // container.empty();

                // Iterate over each region and create a row with columns for each
                parsedObject.forEach(function(region, index) {
                // var regions = 'Region ${index}:' + recs

                    // parse the recommendation 
                    const proc_str = process_region_str(recs[index])
                    const proc_stats = process_region_str(stats[index])

                    // Choosing which example to show on the initial guide page
                    // For the 5th region we switch the example to one that is a question in order to maintain consistency.
                    const ex_index = index === 5 ? 10 : 0;

                    // initialize a count of 0 for each guideline
                    clickCounts.push(0)
                    exampleCounts.push(0)
                    guidelineNames.push(recs[index])

                    // Create a card element
                    var card = $('<div>', {
                        class: 'card region mb-4',
                        id: "button"+String(index),
                        click: function() {
                            showDetails(region, index, recs[index], stats[index]);
                        }
                    });

                    // Create a card body
                    var cardBody = $('<div>', {
                        class: 'card-body text-left',
                    });

                    // Create a card title
                    var cardTitle = $('<h3>', {
                        class: 'card-title',
                        // text: 'Region ' + (index + 1),
                        text: proc_str[1],
                    });

                    var cardText = $('<p>', {
                        class: 'card-text',
                        html: '<h5>Accuracies</h5>' + proc_stats[1] + '<br>' +  proc_stats[2],
                        // html: '<h5>Accuracies</h5>' + boldString(proc_stats[1], 'AI Accuracy') + '<br>' +  boldString(proc_stats[2], 'Human Accuracy'),
                    });

                    var cardExample = $('<p>', {
                        class: 'card-text',
                        // html: '<h5>Example</h5>' + '<ul><li>' + formatExample(region[0]) + '</li></ul>',
                        html: '<h5>Example</h5>' + '<ul><li>' + formatExample(region[ex_index]) + '</li></ul>',
                    });

                    // Add a class based on the condition
                    if (proc_str[0].includes('Rely')) {
                        card.addClass('green-tile');
                        rely_col.append(card)
                        // non-color-based cue
                        var cardMark =$('<span>', {
                            class: "marker",
                            text: "\u2714",
                        });
                        // maxCardHeight = Math.max(maxCardHeight, card[0].clientHeight);

                    } else {
                        card.addClass('red-tile')                        
                        ignore_col.append(card)
                        // non-color-based cue
                        var cardMark =$('<span>', {
                            class: "marker",
                            text: "\u2718",
                        });
                        // maxCardHeight = Math.max(maxCardHeight, card[0].clientHeight);
                    }

                    // Append card title to card body
                    cardBody.append(cardTitle).append(cardText).append(cardExample);

                    // Append card body to card
                    card.append(cardMark).append(cardBody);

                });

            // Append the row to the container
            row.append(rely_col).append(ignore_col);
            container.append(row);
            // scroll down to regions after displaying them
            container[0].scrollIntoView()

            // add button
            // Create a "Continue" button
            const continueButton = $('<button>', {
                type: 'button',

                class: 'btn btn-primary btn-block mb-3',
                id: 'continue',
                text: 'Continue',
                click: function() {
                    logTimeSpent();
                }
            });
            container.append(continueButton)

            // Catch data format and parsing errors
            } else {
                console.error('Parsed data is not an array:', parsedObject);
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    })
     // Log an error if fetching fails
    // .fail(function() {
    .catch((error) => {
        console.error('Error fetching data from data.json');
        // console.log('error=', error)
    });
}

function formatExample(example) {
    var ex = example.split('<br>A:')[0];
    // ex = boldString(ex, 'Question:')
    return ex
}

// Split the string on the <br> tag
function process_region_str(str) {
    var lines = str.split('<br>');
    return lines
}

function boldString(string, boldPart) {
    let stringWithBold = string.replace(boldPart, `<strong>${boldPart}</strong>`);
    // console.log('bold', stringWithBold)
    return stringWithBold
}

function boldQandA(string) {
    let split_str = process_region_str(string)
    let q = boldString(split_str[0], 'Question:')
    let a = boldString(split_str[1], 'A:')
    let b = boldString(split_str[2], 'B:')
    let c = boldString(split_str[3], 'C:')
    let d = boldString(split_str[4], 'D:')

    return q + '<br>' + a + '<br>' + b + '<br>' + c + '<br>' + d
}

// Shows all of the regions in a sidebar
function createSidebarList(recs, stats) {
    // Select the sidebar content div
    var sidebarContent = $('#sidebarContent');

    // Create a list group element
    var listGroup = $('<ul>', {
        class: 'list-group'
    });

    // const stats = data.tasks.task_0exp_condition_2.teaching_ours_stats;

    // Iterate over each tile name and create a list item
    recs.forEach(function (tileName, index) {
        // console.log('tileName=',tileName)
        // console.log('tilenameIndex', index)
        const proc_str = process_region_str(tileName)
        const proc_stats = process_region_str(stats[index])


        var listItem = $('<button>', {
            type: "button",
            class: 'list-group-item list-group-item-action mb-3',
            click: function() {
                // Trigger the click event of appropriate button
                document.getElementById("button"+String(index)).click();
            },
            id: 'Region' + index,
            html: `<h5>${proc_str[1]}</h5>` +  boldString(proc_stats[1], 'AI Accuracy') +  boldString(proc_stats[2], 'Human Accuracy'),
        });

        // Add a class based on the condition
        if (proc_str[0].includes('Rely')) {
            listItem.addClass('green-tile');
            var cardMark =$('<span>', {
                class: "marker-sidebar",
                text: "\u2714",
            });
            

        } else {
            listItem.addClass('red-tile')
            var cardMark =$('<span>', {
                class: "marker-sidebar",
                text: "\u2718",
            });                        

        }
        listItem.prepend(cardMark)

        // Append the list item to the list group
        listGroup.append(listItem);
    });

    // Append the list group to the sidebar content
    sidebarContent.append(listGroup);
}


// change the region-details so that we can iterate through all of the examples easily
// with a single button
// Also need to add the actual region information that says "Don't trust AI when..."

function showRegions() {
    constructTiles()
    disableButton('show-regions-button')
}

function showDetails(region, index, rec, stats) {
    // const detailsContent = document.getElementById('details-content');
    // Increment the click count for this region
    if (index >= 0 && index < clickCounts.length) {
        // Increment the value at the specified index
        clickCounts[index]++;
    } else {
    console.error("Index is out of bounds");
    }
    // record the click sequence
    clickSeq.push(index)
    // On first visit we initialize the time
    if (visited === timeSeq.length) {
        startGuideline = performance.now()
        visited++ 
    } else {
        newStartGuideline = performance.now();
        timeInGuideline = performance.now() - startGuideline;
        timeSeq.push(timeInGuideline);
        startGuideline = newStartGuideline;
        visited++
    }
    

    const detailsContainer = document.getElementById('details-container');
    const backButton = document.getElementById('backButton')
    const instructions = document.getElementById('instructions');
    const regions = document.getElementById('tiles-container');
    // var tiles = document.getElementsByClassName('container');

    // Hide top jumbotron instructions when details are shown
    instructions.style.display = 'none'
    regions.style.display = 'none'

    // Show details container
    // populateDetailsCard(jsonData);
    getRegionData(region, index, rec, stats)
    detailsContainer.style.display = 'block';
    backButton.style.display = 'block';

    }


function goBack() {
    const detailsContainer = document.getElementById('details-container');
    const backButton = document.getElementById('backButton')
    const instructions = document.getElementById('instructions');
    const regions = document.getElementById('tiles-container');

    // Reset the color for the recommendation header on the details page
    $("#details-rec").removeClass('red-tile green-tile')

    //  reshow the instructions and regions
    instructions.style.display = 'block'
    regions.style.display = 'block'

    // Hide details container
    detailsContainer.style.display = 'none';
    backButton.style.display = 'none';

    // record timeSeq
    if (visited != timeSeq.length) {
        timeInGuideline = performance.now() - startGuideline;
        timeSeq.push(timeInGuideline)
    }

    // auto scroll to the regions container when going back
    regions.scrollIntoView();
    }

// Function to fetch data from data.json
function getRegionData(region, regionNum, rec, stats) {
    try {
        // console.log('Selected Region:', region);
        // console.log('Selected Rec', rec)
        // console.log('regionNum', regionNum)

        // You can use the selectedRegion data as needed
        // Populate the details card with the selected data
        populateDetailsCard(region, rec, stats, regionNum);
        hideSidebarItem(regionNum)

    } catch (error) {
        console.error('Error populating details card', error);
    }
}

// Function to hide the corresponding list item in the sidebar - only want to show non-selected regions.
function hideSidebarItem(selectedRegion) {
    // console.log('selReg', selectedRegion)
    // // Remove the 'active' class from all list items
    $('#sidebarContent .list-group-item').removeClass('hidden-list-item');

    // // Find the list item with the corresponding identifier and add the 'active' class
    $('#Region' + selectedRegion).addClass('hidden-list-item');

    // $('#Region' + selectedRegion).remove()
}


// Add Function to style the recommendation text so that it isn't so ugly

// Split the string on the <br> tag
function process_region_str(str) {
    var lines = str.split('<br>');
    return lines
}

// Function to populate details card with JSON data
function populateDetailsCard(region, rec, stats, regionNum) {
    carouselNum = regionNum
    const proc_str = process_region_str(rec)
    const proc_stats = process_region_str(stats)

    let rec_str = proc_str[0].includes("Rely") 
    ? "For instances like these, AI is typically but not always CORRECT" 
    : "For instances like these, AI is typically but not always WRONG";
    // Update the details card content
    const region_descr_str = '<h4>' + proc_str[1] + '</h4>'
    // const region_rec_str = '<h4>' + proc_str[0] + '</h4>'
    const region_rec_str = '<h4>' + rec_str + '</h4>'


    // <span class="text-success">&#10004;</span> <!-- Checkmark (✔) -->
    // <span class="text-danger">&#10008;</span> <!-- X (✘) -->
    $("#details-rec").html(region_descr_str + '<br>' + region_rec_str + '<br>' + '<h5>Accuracies</h5>' + proc_stats[1] + '<br>' +  proc_stats[2]);
    // Remove any existing green/red tile classes
    $("#details-rec").removeClass('green-tile')
    $("#details-rec").removeClass('red-tile')

    // Add a class based on the condition
    if (proc_str[0].includes('Rely')) {
        $("#details-rec").addClass('green-tile');
        var cardMark =$('<span>', {
            class: "marker",
            text: "\u2714",
        });
        $("#details-rec").append(cardMark)     

    } else {
        $("#details-rec").addClass('red-tile');
        var cardMark =$('<span>', {
            class: "marker",
            text: "\u2718",
        });
        $("#details-rec").append(cardMark)                   
    }

    


//     const content_str = `
//     Below is an example data point that belongs to this region.
//     Use the buttons below to review more examples.
// `
    const content_str = `
    <h4 text-center>Explore Specific Examples</h4>
`
    $("#details-content").html(content_str);

        // Update the details card content
    let carouselItems = '';

    // Allows us to skip displaying certain examples if needed 
    // const skip_ex_index = regionNum === 5 ? 10 : 0;
    const default_active = regionNum === 5 ? 0 : 1;

    // Iterate through the region array and create carousel items
    region.forEach((regionItem, index) => {
        if (index !== (region.length -1)) {
            carouselItems += `
            <div class="carousel-item ${index === default_active ? 'active' : ''}">
                <div class="card-body">${boldQandA(regionItem)}</div>
            </div>
        `;
        }

    });


    // Create the carousel structure with navigation buttons
    const carousel = `
    <div class="card-body">
        <div id="regionCarousel" class="carousel slide" data-ride="carousel">
            <div class="carousel-inner">
                ${carouselItems}
            </div>
            <div class="progress mt-3">
                <div class="progress-bar" role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
        </div>
    </div>

`;


    // Append the carousel to the details card
    $("#details-example").html(carousel);

    // Initialize the carousel with manual controls
    $('#regionCarousel').carousel({
        interval: false, // Disable automatic sliding
    });

    // Add event listener to update progress bar on slide change
    $('#regionCarousel').on('slide.bs.carousel', function (event) {
        var totalSlides = $('#regionCarousel .carousel-item').length;
        var currentSlideIndex = event.to + 1;
        var progressPercentage = (currentSlideIndex / totalSlides) * 100;

        // Update progress bar
        $('.progress-bar').css('width', progressPercentage + '%');
        $('.progress-bar').attr('aria-valuenow', progressPercentage);
    });

    // Scroll to the top of the page with smooth animation
    $('html, body').animate({ scrollTop: 0 }, 'slow');
    // console.log('tst', $('#regionCarousel .carousel-item.active').index())
}

// Add event listener to the button for manual navigation
$('#buttonNext').on('click', function() {
    $('#regionCarousel').carousel('next');
    exampleCounts[carouselNum]++
    // updatePagerNumbers();
});

$('#buttonPrev').on('click', function() {
    $('#regionCarousel').carousel('prev');
    exampleCounts[carouselNum]++
    // updatePagerNumbers();
});

function enableBeforeUnload() {
    window.onbeforeunload = function (e) {
      return "Discard changes? Your work will be lost.";
    };
  }

function disableBeforeUnload() {
window.onbeforeunload = null;
}

enableBeforeUnload();

// Timing
const startTime = performance.now();

//  add event listener to the continue button
$('#continue').on('click', logTimeSpent);
function updateTotalTime(newTimeSpent) {
    var ts = JSON.parse(localStorage["totalTimeSpent"]);
    ts = ts + newTimeSpent
    // Store the updated value back into local storage
    localStorage.setItem('totalTimeSpent', JSON.stringify(ts));
  }

function logTimeSpent() {
  timeSpent = performance.now() - startTime
  // Log the time spent
  // console.log('Time spent before clicking Next: ' + timeSpent + ' milliseconds');
  // Log the response
  updateTotalTime(timeSpent)
  writeUserData()
}

function writeUserData() {
  // Remove the event listener after logging the time
  $('#continue').off('click', logTimeSpent);
  // console.log('response_id=', response_id)
  db.collection("responses_mmlu" + onboarding_setting)
    .doc(response_id)
    .update({
      time_spent_guidelines: timeSpent,
      guidelines_clicks: clickCounts,
      guidelines_names: guidelineNames,
      guidelines_click_seq: clickSeq,
      guidelines_time_seq: timeSeq,
      example_counts: exampleCounts,
    })
    .then(() => {
      console.log("Response successfully written!");
      nextPage('./verify-seq.html');
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
