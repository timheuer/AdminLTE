/* Pi-hole: A black hole for Internet advertisements
 *  (c) 2017 Pi-hole, LLC (https://pi-hole.net)
 *  Network-wide ad blocking via your own hardware.
 *
 *  This file is copyright under the latest version of the EUPL.
 *  Please see LICENSE file for your rights under this license. */

/* global moment:false, utils:false */

var start__ = moment().subtract(6, "days");
var from = moment(start__).utc().valueOf() / 1000;
var end__ = moment();
var until = moment(end__).utc().valueOf() / 1000;
var instantquery = false;
var daterange;

var timeoutWarning = $("#timeoutWarning");

var dateformat = "MMMM Do YYYY, HH:mm";

// Do we want to filter queries?
var GETDict = {};
window.location.search
  .substr(1)
  .split("&")
  .forEach(function (item) {
    GETDict[item.split("=")[0]] = item.split("=")[1];
  });

if ("from" in GETDict && "until" in GETDict) {
  from = parseInt(GETDict.from, 10);
  until = parseInt(GETDict.until, 10);
  start__ = moment(1000 * from);
  end__ = moment(1000 * until);
  instantquery = true;
}

$(function () {
  daterange = $("#querytime").daterangepicker(
    {
      timePicker: true,
      timePickerIncrement: 15,
      timePicker24Hour: true,
      locale: { format: dateformat },
      startDate: start__,
      endDate: end__,
      ranges: {
        Today: [moment().startOf("day"), moment()],
        Yesterday: [
          moment().subtract(1, "days").startOf("day"),
          moment().subtract(1, "days").endOf("day")
        ],
        "Last 7 Days": [moment().subtract(6, "days"), moment()],
        "Last 30 Days": [moment().subtract(29, "days"), moment()],
        "This Month": [moment().startOf("month"), moment()],
        "Last Month": [
          moment().subtract(1, "month").startOf("month"),
          moment().subtract(1, "month").endOf("month")
        ],
        "This Year": [moment().startOf("year"), moment()],
        "All Time": [moment(0), moment()]
      },
      opens: "center",
      showDropdowns: true,
      autoUpdateInput: false
    },
    function (startt, endt) {
      from = moment(startt).utc().valueOf() / 1000;
      until = moment(endt).utc().valueOf() / 1000;
    }
  );
});

var tableApi, statistics;

function handleAjaxError(xhr, textStatus) {
  if (textStatus === "timeout") {
    alert("The server took too long to send the data.");
  } else if (xhr.responseText.indexOf("Connection refused") !== -1) {
    alert("An error occurred while loading the data: Connection refused. Is FTL running?");
  } else {
    alert(
      "An unknown error occurred while loading the data.\n" +
        xhr.responseText +
        "\nCheck the server's log files (/var/log/lighttpd/error.log when you're using the default Pi-hole web server) for details. You may need to increase the memory available for Pi-hole in case you requested a lot of data."
    );
  }

  $("#all-queries_processing").hide();
  tableApi.clear();
  tableApi.draw();
}

function getQueryTypes() {
  var queryType = [];
  if ($("#type_gravity").prop("checked")) {
    queryType.push(1);
  }

  if ($("#type_forwarded").prop("checked")) {
    queryType.push([2, 14]);
  }

  if ($("#type_cached").prop("checked")) {
    queryType.push(3);
  }

  if ($("#type_regex").prop("checked")) {
    queryType.push(4);
  }

  if ($("#type_denylist").prop("checked")) {
    queryType.push(5);
  }

  if ($("#type_external").prop("checked")) {
    // Multiple IDs correspond to this status
    // We request queries with all of them
    queryType.push([6, 7, 8]);
  }

  if ($("#type_gravity_CNAME").prop("checked")) {
    queryType.push(9);
  }

  if ($("#type_regex_CNAME").prop("checked")) {
    queryType.push(10);
  }

  if ($("#type_denylist_CNAME").prop("checked")) {
    queryType.push(11);
  }

  if ($("#type_retried").prop("checked")) {
    // Multiple IDs correspond to this status
    // We request queries with all of them
    queryType.push([12, 13]);
  }

  return queryType.join(",");
}

var reloadCallback = function () {
  timeoutWarning.hide();
  statistics = [0, 0, 0, 0];
  var data = tableApi.rows().data();
  for (var i = 0; i < data.length; i++) {
    statistics[0]++; // TOTAL query
    if (data[i][4] === 1 || (data[i][4] > 4 && ![10, 12, 13, 14].includes(data[i][4]))) {
      statistics[2]++; // EXACT blocked
    } else if (data[i][4] === 3) {
      statistics[1]++; // CACHE query
    } else if (data[i][4] === 4 || data[i][4] === 10) {
      statistics[3]++; // REGEX blocked
    }
  }

  $("h3#dns_queries").text(statistics[0].toLocaleString());
  $("h3#ads_blocked_exact").text(statistics[2].toLocaleString());
  $("h3#ads_wildcard_blocked").text(statistics[3].toLocaleString());

  var percent = 0;
  if (statistics[2] + statistics[3] > 0) {
    percent = (100 * (statistics[2] + statistics[3])) / statistics[0];
  }

  $("h3#ads_percentage_today").text(parseFloat(percent).toFixed(1).toLocaleString() + " %");
};

function refreshTableData() {
  timeoutWarning.show();
  var APIstring = "api_db.php?getAllQueries&from=" + from + "&until=" + until;
  // Check if query type filtering is enabled
  var queryType = getQueryTypes();
  if (queryType !== "1,2,3,4,5,6") {
    APIstring += "&types=" + queryType;
  }

  statistics = [0, 0, 0];
  tableApi.ajax.url(APIstring).load(reloadCallback);
}

$(function () {
  var APIstring = instantquery
    ? "api_db.php?getAllQueries&from=" + from + "&until=" + until
    : "api_db.php?getAllQueries=empty";

  // Check if query type filtering is enabled
  var queryType = getQueryTypes();
  if (queryType !== 63) {
    // 63 (0b00111111) = all possible query types are selected
    APIstring += "&types=" + queryType;
  }

  tableApi = $("#all-queries").DataTable({
    rowCallback: function (row, data) {
      var fieldtext, buttontext, color;
      switch (data[4]) {
        case 1:
          color = "red";
          fieldtext = "Blocked (gravity)";
          buttontext =
            '<button type="button" class="btn btn-default btn-sm text-green"><i class="fas fa-check"></i> Allowlist</button>';
          break;
        case 2:
          color = "green";
          fieldtext =
            "OK <br class='hidden-lg'>(forwarded to " +
            (data.length > 5 && data[5] !== "N/A" ? data[5] : "") +
            ")";
          buttontext =
            '<button type="button" class="btn btn-default btn-sm text-red"><i class="fa fa-ban"></i> Denylist</button>';
          break;
        case 3:
          color = "green";
          fieldtext = "OK <br class='hidden-lg'>(cached)";
          buttontext =
            '<button type="button" class="btn btn-default btn-sm text-red"><i class="fa fa-ban"></i> Denylist</button>';
          break;
        case 4:
          color = "red";
          fieldtext = "Blocked <br class='hidden-lg'>(regex denylist)";
          buttontext =
            '<button type="button" class="btn btn-default btn-sm text-green"><i class="fas fa-check"></i> Allowlist</button>';
          break;
        case 5:
          color = "red";
          fieldtext = "Blocked <br class='hidden-lg'>(exact denylist)";
          buttontext =
            '<button type="button" class="btn btn-default btn-sm text-green"><i class="fas fa-check"></i> Allowlist</button>';
          break;
        case 6:
          color = "red";
          fieldtext = "Blocked <br class='hidden-lg'>(external, IP)";
          buttontext = "";
          break;
        case 7:
          color = "red";
          fieldtext = "Blocked <br class='hidden-lg'>(external, NULL)";
          buttontext = "";
          break;
        case 8:
          color = "red";
          fieldtext = "Blocked <br class='hidden-lg'>(external, NXRA)";
          buttontext = "";
          break;
        case 9:
          color = "red";
          fieldtext = "Blocked (gravity, CNAME)";
          buttontext =
            '<button type="button" class="btn btn-default btn-sm text-green"><i class="fas fa-check"></i> Allowlist</button>';
          break;
        case 10:
          color = "red";
          fieldtext = "Blocked <br class='hidden-lg'>(regex denylist, CNAME)";
          buttontext =
            '<button type="button" class="btn btn-default btn-sm text-green"><i class="fas fa-check"></i> Allowlist</button>';
          break;
        case 11:
          color = "red";
          fieldtext = "Blocked <br class='hidden-lg'>(exact denylist, CNAME)";
          buttontext =
            '<button type="button" class="btn btn-default btn-sm text-green"><i class="fas fa-check"></i> Allowlist</button>';
          break;
        case 12:
          color = "green";
          fieldtext = "Retried";
          buttontext = "";
          break;
        case 13:
          color = "green";
          fieldtext = "Retried <br class='hidden-lg'>(ignored)";
          buttontext = "";
          break;
        case 14:
          color = "green";
          fieldtext = "OK <br class='hidden-lg'>(already forwarded)";
          buttontext =
            '<button type="button" class="btn btn-default btn-sm text-red"><i class="fa fa-ban"></i> Denylist</button>';
          break;
        default:
          color = "deny";
          fieldtext = "Unknown";
          buttontext = "";
      }

      $(row).css("color", color);
      $("td:eq(4)", row).html(fieldtext);
      $("td:eq(5)", row).html(buttontext);

      // Substitute domain by "." if empty
      var domain = data[2];
      if (domain.length === 0) {
        domain = ".";
      }

      $("td:eq(2)", row).text(domain);
    },
    dom:
      "<'row'<'col-sm-12'f>>" +
      "<'row'<'col-sm-4'l><'col-sm-8'p>>" +
      "<'row'<'col-sm-12'<'table-responsive'tr>>>" +
      "<'row'<'col-sm-5'i><'col-sm-7'p>>",
    ajax: {
      url: APIstring,
      error: handleAjaxError,
      dataSrc: function (data) {
        var dataIndex = 0;
        return data.data.map(function (x) {
          x[0] = x[0] * 1e6 + dataIndex++;
          return x;
        });
      }
    },
    autoWidth: false,
    processing: true,
    deferRender: true,
    order: [[0, "desc"]],
    columns: [
      {
        width: "15%",
        render: function (data, type) {
          if (type === "display") {
            return moment
              .unix(Math.floor(data / 1e6))
              .format("Y-MM-DD [<br class='hidden-lg'>]HH:mm:ss z");
          }

          return data;
        }
      },
      { width: "10%" },
      { width: "40%", render: $.fn.dataTable.render.text() },
      { width: "20%", type: "ip-address", render: $.fn.dataTable.render.text() },
      { width: "10%" },
      { width: "5%" }
    ],
    lengthMenu: [
      [10, 25, 50, 100, -1],
      [10, 25, 50, 100, "All"]
    ],
    columnDefs: [
      {
        targets: -1,
        data: null,
        defaultContent: ""
      }
    ],
    initComplete: reloadCallback
  });
  $("#all-queries tbody").on("click", "button", function () {
    var data = tableApi.row($(this).parents("tr")).data();
    if ([1, 4, 5, 9, 10, 11].indexOf(data[4]) !== -1) {
      utils.addFromQueryLog(data[2], "allow");
    } else {
      utils.addFromQueryLog(data[2], "deny");
    }
  });

  if (instantquery) {
    daterange.val(start__.format(dateformat) + " - " + end__.format(dateformat));
  }
});

$("#querytime").on("apply.daterangepicker", function (ev, picker) {
  $(this).val(picker.startDate.format(dateformat) + " to " + picker.endDate.format(dateformat));
  refreshTableData();
});
