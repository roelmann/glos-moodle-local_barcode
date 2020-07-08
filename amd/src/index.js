define(['jquery', 'core/str'], function($, str) {
    // Initial variables.
    var cmid,
        link,
        code,
        message    = '',
        assignment = '-',
        assignmentdescription = '',
        course,
        duedate,
        idformat,
        studentid,
        studentname,
        submissiontime,
        submitted = 'Not Submitted',
        islate,
        revert = '0',
        ontime = '0',
        hasReverted = 0,
        strings = [];

    /**
     * When the page loads then focus on the barcode input and listen for keypresses.
     * Additionally, create the barcode table and set the web token
     * @return {void}
     */
    function load() {
        $('.path-local-barcode #id_barcode').focus();
        $('.path-local-barcode #id_barcode').keypress(function(ev) {
            var key = ev.which || ev.keyCode;
            if (key === 13) {
                ev.stopPropagation();
                ev.preventDefault();
                setRevert();
                setOnTime();
                submitBarcode(ev);
                return false;
            }
        });

        $('.path-local-barcode #id_submitbutton').on('click', function(ev) {
            ev.stopPropagation();
            ev.preventDefault();
            setRevert();
            setOnTime();
            submitBarcode(ev);
            return false;
        });

        addCombinedCountElement();

        var langStrings = str.get_strings([
            {key: 'assignmentdetails', component: 'local_barcode'},
            {key: 'barcodes', component: 'local_barcode'},
            {key: 'draft', component: 'local_barcode'},
            {key: 'draftandsubmissionerror', component: 'local_barcode'},
            {key: 'due', component: 'local_barcode'},
            {key: 'notsubmitted', component: 'local_barcode'},
            {key: 'scanned', component: 'local_barcode'},
            {key: 'student', component: 'local_barcode'},
            {key: 'submitted', component: 'local_barcode'}
        ]);

        $.when(langStrings).done(function(localizedStrings) {
            strings = localizedStrings;
            createTable();
        });
    }

    /**
     * Submit the barcode and prevent the form from submitting to the server
     * @param  {event} ev   The standard submit event
     * @return {boolean}    Return false
     */
    function submitBarcode(ev) {
        ev.stopPropagation();
        ev.preventDefault();

        var barcode = getBarcode();

        if (barcode && !formIsValid()) {
            $('#feedback').html(strings[3]);
            $('#feedback-group').addClass('local-barcode-has-inform');
            $('#feedback-group').removeClass('local-barcode-has-danger');
            $('#feedback-group').removeClass('local-barcode-has-success');
        }
        // Make the ajax call to the webservice.
        if (barcode && formIsValid()) {
            saveBarcode(barcode);
        }
        $('.path-local-barcode #id_barcode').focus();
        return false;
    }

    /**
     * Get the barcode entered into the text field
     *
     * @return {string}     the new entered barcode
     */
    function getBarcode() {
        return $('.path-local-barcode #id_barcode').val().trim();
    }

    /**
     * Reset the input text field to an empty value for the next entry
     */
    function resetBarcode() {
        $('.path-local-barcode #id_barcode').val('');
    }

    /**
     * Prevent the user submitting the form if both revert to draft and allow late submission
     * has been selected, you can't have both
     * @return {boolean} Whether or not the form is valid
     */
    function formIsValid() {
        if (revert !== '0' && ontime !== '0') {
            return false;
        }
        return true;
    }

    /**
     * Save the barcode to the database
     * @param  {string} wstoken  The auth web token
     * @param  {string} barcode  The barcode
     * @return {void}
     */
    function saveBarcode(barcode) {
        var uploadUrl = 'service/upload.php?barcode=';
        if (link) {
            uploadUrl = '../service/upload.php?barcode=';
        }
        $.ajax({
            type: "POST",
            url: uploadUrl + barcode + '&id=' + cmid + '&revert=' + revert + '&ontime=' + ontime,
            data: {
                barcode: barcode
            },
            success: function(response) {
                if (typeof response.faultCode !== 'undefined') {
                    code = response.faultString;
                    message = response.faultString;
                } else {
                    code           = response.data.code;
                    message        = response.data.message;
                    assignment     = response.data.assignment;
                    assignmentdescription = response.data.assignmentdescription;
                    course         = response.data.course;
                    duedate        = response.data.duedate;
                    idformat       = response.data.idformat;
                    studentid      = response.data.studentid;
                    studentname    = response.data.studentname;
                    submissiontime = response.data.submissiontime;
                    islate         = response.data.islate;
                    hasReverted    = response.data.reverted;

                    if (! getAllowMultipleScans()) {
                        resetRevert();
                        resetOnTime();
                    }
                }
                feedback();
            },
            error: function(response) {
                message = response.data.message;
            },
            dataType: "json"
        });
    }

    /**
     * Display the feedback message to the user
     * @return {void}
     */
    function feedback() {
        var feedback = $('#feedback');
        feedback.html(message);
        var error = 0;

        if (code === 200) {
            if (hasReverted) {
                submitted = strings[2];
                $('#feedback-group').addClass('local-barcode-has-success');
                $('#feedback-group').removeClass('local-barcode-has-danger');
                $('#feedback-group').removeClass('local-barcode-has-inform');
                addTableRow('revert');
            } else {
                submitted = strings[8];
                $('#feedback-group').removeClass('local-barcode-has-danger');
                $('#feedback-group').removeClass('local-barcode-has-inform');
                $('#feedback-group').addClass('local-barcode-has-success');
                addTableRow('success');
            }
        }

        if (code === 404) {
            assignment = '-';
        }

        if (code !== 200) {
            submitted  = strings[6];
            $('#feedback-group').removeClass('local-barcode-has-success');
            $('#feedback-group').removeClass('local-barcode-has-inform');
            $('#feedback-group').addClass('local-barcode-has-danger');
            addTableRow('fail');
            error = 1;
        }
        resetBarcode();
        updateCounts(error);
    }

    /**
     * Create the barcode submissions table
     */
    function createTable() {
        var main = $('#region-main');
        var table = $('<table></table>');
        table.attr('id', 'local-barcode-table');
        table.addClass('generaltable');
        table.addClass('local-barcode-table');

        var thead = table.append('<thead></thead>');
        var header = thead.append('<tr></tr>');
        header.html('<th colspan="8" class="local-barcode-th-left local-barcode-sm-hide">' + strings[1] +
                ' - (<span id="local_barcode_id_count">' +
                '0</span> ' + strings[6] + ')</th>' +
                '<th colspan="17" class="local-barcode-th-center">' + strings[0] + '</th>' +
                '<th colspan="5" class="local-barcode-th-right">' + strings[8] +
                '(<span id="local_barcode_id_submit_count">0</span>)</th>');
        table.append('<tbody id="tbody"></tbody>');

        main.append(table);
    }

    /**
     * Add a new row to the barcodes table
     * @param {string} css  The css class condition
     */
    function addTableRow(css) {
        var cssClass = 'local-barcode-' + css;
        var colspans = [8, 17, 5];
        var arr = getData();
        var tbody = $('#tbody');
        var row = $('<tr></tr>');

        for (var i = 0; i <= 2; i++) {
            var cell = $('<td></td>');
            var span = $('<span></span>');

            cell.attr('colspan', colspans[i]);
            span.html(arr[i]);
            cell.append(span);
            // Hide the first cell on small screens.
            if (i === 0) {
                cell.addClass('local-barcode-sm-hide');
            }
            if (i === 2)  {
                cssClass += ' local-barcode-td-position';
                span.addClass('local-barcode-visuallyhidden');
                cell.addClass(cssClass);
            }
            row.append(cell);
        }
        tbody.prepend(row);
    }

    /**
     * Get the data for displaying in the table
     * @return {array} The data in an array
     */
    function getData() {
        var submissionClass = 'local-barcode-ontime';
        if (islate) {
            submissionClass = 'local-barcode-islate';
        }
        return [
            getBarcode(),
            assignment + '<br />' +
            '<small>' + assignmentdescription.substring(0, 30) + '</small><br />' +
            '<small>' + course + '</small><br />' +
            '<small>' + strings[7] + ': ' + studentname + ' / ' + idformat + ': ' + studentid + '</small><br />' +
            '<small>' + strings[4] + ': ' + duedate + '&nbsp; ' + strings[6] + ': <span class="' +
                submissionClass + '">' + submissiontime +
            '</span></small><br />',
            submitted
        ];
    }

    /**
     * Display the total number of scanned barcodes in the barcode table
     * @return {void}
     */
    function outputBarcodeCount(count) {
        $('#local_barcode_id_count').html(count);
        $('#local_barcode_id_scanned_count').html(count);
        return false;
    }

    /**
     * Display the number of successfully submitted barcodes
     * @return {void}
     */
    function outputSubmittedCount(count) {
        $('#local_barcode_id_submit_count').html(count);
        $('#local_barcode_id_submitted_count').html(count);
        return false;
    }

    /**
     * Checks whether or not the submission is to revert to draft or not
     * @return {[type]} [description]
     */
    function setRevert() {
        if ($('.path-local-barcode #id_reverttodraft').is(':checked')) {
            revert = '1';
        } else {
            revert = '0';
        }
    }

    /**
     * Reset the revert to draft checkbox
     * @return {void}
     */
    function resetRevert() {
        $('.path-local-barcode #id_reverttodraft').prop('checked', false);
    }

    function setOnTime() {
        if ($('.path-local-barcode #id_submitontime') &&
                $('.path-local-barcode #id_submitontime').is('checked')) {
            ontime = '1';
        } else {
            ontime = '0';
        }
    }

    /**
     * Reset the allow late submission checkbox
     * @return {void}
     */
    function resetOnTime() {
        $('.path-local-barcode #id_submitontime').prop('checked', false);
    }

    /**
     * Enable multiple scans at the same time
     * @return boolean
     */
    function getAllowMultipleScans() {
        return $('.path-local-barcode #id_multiplescans').is('checked');
    }

    /**
     * Add the scanned and submitted counts next to the barcode input element
     */
    function addCombinedCountElement() {
        $('.path-local-barcode #id_barcode').after(function() {
            return '<span class="local-barcode-combined-counts local-barcode-inform-inline">(' +
                       '<span id="local_barcode_id_scanned_count">0</span> / ' +
                       '<span id="local_barcode_id_submitted_count">0</span>)' +
                    '</span>';
        });
    }

    /**
     * Update the submitted and scaned counts
     * @param  {int} error Whether or not there was an error, 1 if there was
     * @return {void}
     */
    function updateCounts(error) {
        var submitted,
            scanned = totalScanned();
        if (error === 1 && !$('#local_barcode_id_submitted_count').hasClass('local-barcode-error-inline')) {
            applyErrorClass();
        }
        if (error === 0) {
            submitted = submittedBarcodes();
            outputSubmittedCount(submitted);
        }
        if (!$('#local_barcode_id_scanned_count').hasClass('local-barcode-success-inline')) {
            $('#local_barcode_id_scanned_count').addClass('local-barcode-success-inline');
        }
        outputBarcodeCount(scanned);
    }

    /**
     * Apply the error class to the #local_barcode_id_submitted_count element if a barcode is not submitted
     * @return {void}
     */
    function applyErrorClass() {
        $('#local_barcode_id_submitted_count').addClass('local-barcode-error-inline');
    }

    // Closure to calculate the total number of scanned barcodes
    // @return {counter}   Returns the number of times all barcodes have been scanned.
    var totalScanned = (function () {
        var counter = 0;
        // Increment the counter.
        function increment() {
            counter += 1;
        }
        // Return the updated counter value.
        return function () {
            increment();
            return counter;
        };
    })();

    // Calculate the number of submitted barcodes
    // Return the number of times a barcode has been submitted.
    // A submitted barcode will only be submitted if it's a valid barcode.
    // @return {counter}.
    var submittedBarcodes = (function() {
        var counter = 0;
        // Increment the counter.
        function increment() {
            counter += 1;
        }
        // Return the updated counter value.
        return function () {
            increment();
            return counter;
        };
    })();

    /**
     * On initialisation call the load function and set the course module id and the type of url to use on ajax call.
     */
    return {
        init: function(id, direct) {
            load();
            cmid = id;
            link = direct;
        },
    };
});
