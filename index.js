const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const argv = require('yargs').argv; // to easily pass arguments in terminal
const url = require('url'); // to deal with url in node
const fs = require('fs'); // to deal with file system (create dir)
const glob = require('glob'); // for matching file
const path = require('path'); // to deal with path in node

// function to launch chrome with url param
// return a promise 
const launchChromeAndRunLighthouse = url => {
    return chromeLauncher.launch().then(chrome => {

        // needed to link the lighthouse instance
        const opts = { port: chrome.port }; 

        //launch lighthouse and return promise
        return lighthouse(url, opts).then(results => {
            return chrome.kill().then(() => {
                return {
                    js: results.lhr,
                    json: results.report
                }
            }) // close chrome window
        });
    });
};

const getContents = pathStr => { // path of json file
    const output = fs.readFileSync(pathStr, "utf8", (err, results) => {
      return results;
    });
    return JSON.parse(output); // return content of specific file
};

const compareReports = (from, to) => { // compare 2 reports with metrics below
    const metricFilter = [
        "first-contentful-paint",
        "first-meaningful-paint",
        "speed-index",
        "estimated-input-latency",
        "total-blocking-time",
        "max-potential-fid",
        "time-to-first-byte",
        "first-cpu-idle",
        "interactive"
    ];

    // to calculate the percentage diff, use this formula => ((From - To) / From) x 100
    const calcPercentageDiff = (from, to) => {
        const per = ((from - to) / ((from + to) / 2) * 100);
        // const per = ((to - from) / from) * 100;
        return Math.round(per * 100) / 100;
    };

    // Loop through audits and check if they have value in metricFilter
    for (let auditObj in from["audits"]) {
        if (metricFilter.includes(auditObj)) { // if metrics is present, calculate percentage diff
            const percentageDiff = calcPercentageDiff(
                from["audits"][auditObj].numericValue,
                to["audits"][auditObj].numericValue
            );

            // log with color in terminal when launching a new report
            let logColor = "\x1b[37m";
            const log = (() => {
              if (Math.sign(percentageDiff) === 1) {
                logColor = "\x1b[31m";
                return `${percentageDiff + "%"} slower`;
              } else if (Math.sign(percentageDiff) === 0) {
                return "unchanged";
              } else {
                logColor = "\x1b[32m";
                return `${percentageDiff + "%"} faster`;
              }
            })();
            console.log(logColor, `${from["audits"][auditObj].title} is ${log}`);
          }

        }

    console.log('\x1b[36m%s\x1b[0m', 'compare this report : ' + from["finalUrl"] + " " + from["fetchTime"]);
    console.log('\x1b[36m%s\x1b[0m', 'to this report' + to["finalUrl"] + " " + to["fetchTime"]);
};

// launch function
if (argv.from && argv.to) { //if argument from && to are present
    compareReports( // compare 2 reports 
        getContents(argv.from + ".json"),
        getContents(argv.to + ".json")
    );
} else if (argv.url !== undefined) { // if argument url is present 
    // save report into directory.
    const urlObj = new URL(argv.url);
    let dirName = urlObj.host.replace('www.','');
    if (urlObj.pathname !== "/") {
        dirName = dirName + urlObj.pathname.replace(/\//g, "_");
    }
    // check if dir already exist
    if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName);
    }  

    launchChromeAndRunLighthouse(argv.url).then(results => {

        const prevReports = glob(`${dirName}/*.json`, {
            sync: true //block execution of javascript
          });

        if (prevReports.length) {
            dates = [];
            for (report in prevReports) {
              dates.push(
                new Date(path.parse(prevReports[report]).name.replace(/_/g, ":"))
              );
            }
            const max = dates.reduce(function(a, b) {
              return Math.max(a, b);
            });
            const recentReport = new Date(max).toISOString();

        // get the contents of last report.
        const recentReportContents = getContents(
            dirName + '/' + recentReport.replace(/:/g, '_') + '.json'
        );

        // compare 2 reports
        compareReports(recentReportContents, results.js);

        }

        // to write reports and save onto right dir
        // 3 params : name of report, content of reports, callback error
        fs.writeFile(
            `${dirName}/${results.js["fetchTime"].replace(/:/g, "_")}.json`,
            results.json,
            err => {
                if (err) throw err;
            }
        );
    });

} else {
    throw "You haven't passed a URL to Lighthouse"
};

