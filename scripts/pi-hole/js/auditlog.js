/* Pi-hole: A black hole for Internet advertisements
 *  (c) 2017 Pi-hole, LLC (https://pi-hole.net)
 *  Network-wide ad blocking via your own hardware.
 *
 *  This file is copyright under the latest version of the EUPL.
 *  Please see LICENSE file for your rights under this license. */

/* global utils:false */

// Define global variables
var auditTimeout = null;

function updateTopLists() {
  $.getJSON("api.php?topItems=audit", function (data) {
    if ("FTLnotrunning" in data) {
      return;
    }

    // Clear tables before filling them with data
    $("#domain-frequency td").parent().remove();
    $("#ad-frequency td").parent().remove();
    var domaintable = $("#domain-frequency").find("tbody:last");
    var adtable = $("#ad-frequency").find("tbody:last");
    var url, domain;
    for (domain in data.top_queries) {
      if (Object.prototype.hasOwnProperty.call(data.top_queries, domain)) {
        // Sanitize domain
        domain = utils.escapeHtml(domain);
        url = '<a href="queries.php?domain=' + domain + '">' + domain + "</a>";
        domaintable.append(
          "<tr><td>" +
            url +
            "</td> <td>" +
            data.top_queries[domain] +
            "</td> <td>" +
            '<button type="button" class="btn btn-default btn-xs text-red"><i class="fa fa-ban"></i> Denylist</button>' +
            '<button type="button" class="btn btn-default btn-xs text-orange"><i class="fa fa-balance-scale"></i> Audit</button>' +
            "</td> </tr> "
        );
      }
    }

    for (domain in data.top_ads) {
      if (Object.prototype.hasOwnProperty.call(data.top_ads, domain)) {
        var input = domain.split(" ");
        // Sanitize domain
        var printdomain = utils.escapeHtml(input[0]);
        if (input.length > 1) {
          url =
            '<a href="queries.php?domain=' +
            printdomain +
            '">' +
            printdomain +
            "</a> (wildcard blocked)";
          adtable.append(
            "<tr><td>" +
              url +
              "</td> <td>" +
              data.top_ads[domain] +
              "</td> <td>" +
              '<button type="button" class="btn btn-default btn-sm text-orange"><i class="fa fa-balance-scale"></i> Audit</button>' +
              "</td> </tr> "
          );
        } else {
          url = '<a href="queries.php?domain=' + printdomain + '">' + printdomain + "</a>";
          adtable.append(
            "<tr><td>" +
              url +
              "</td> <td>" +
              data.top_ads[domain] +
              "</td> <td>" +
              '<button type="button" class="btn btn-default btn-xs text-green"><i class="fas fa-check"></i> Allowlist</button>' +
              '<button type="button" class="btn btn-default btn-xs text-orange"><i class="fa fa-balance-scale"></i> Audit</button>' +
              "</td> </tr> "
          );
        }
      }
    }

    $("#domain-frequency .overlay").hide();
    $("#ad-frequency .overlay").hide();
    // Update top lists data every ten seconds
    // Updates are also triggered by button actions
    // and reset the running timer
    if (auditTimeout !== null) {
      window.clearTimeout(auditTimeout);
    }

    auditTimeout = setTimeout(updateTopLists, 10000);
  });
}

function add(domain, list) {
  var token = $("#token").text();
  $.ajax({
    url: "scripts/pi-hole/php/groups.php",
    method: "post",
    data: {
      domain: domain,
      list: list,
      token: token,
      action: list === "audit" ? "add_audit" : "add_domain",
      comment: "Added from Audit Log"
    },
    success: function () {
      updateTopLists();
    },
    error: function (jqXHR, exception) {
      console.log(exception); // eslint-disable-line no-console
    }
  });
}

function denylistUrl(url) {
  // We add to audit last as it will reload the table on success
  add(url, "deny");
  add(url, "audit");
}

function allowlistUrl(url) {
  // We add to audit last as it will reload the table on success
  add(url, "allow");
  add(url, "audit");
}

function auditUrl(url) {
  add(url, "audit");
}

$(function () {
  // Pull in data via AJAX
  updateTopLists();

  $("#domain-frequency tbody").on("click", "button", function (event) {
    var url = $(this).parents("tr")[0].textContent.split(" ")[0];

    if (event.target.textContent.trim() === "Denylist") {
      denylistUrl(url);
    } else {
      auditUrl(url);
    }
  });

  $("#ad-frequency tbody").on("click", "button", function (event) {
    var url = $(this).parents("tr")[0].textContent.split(" ")[0];

    if (event.target.textContent.trim() === "Allowlist") {
      allowlistUrl(url);
    } else {
      auditUrl(url);
    }
  });
});
