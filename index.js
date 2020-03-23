const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const argv = require('yargs').argv; // to easily pass arguments in terminal
const url = require('url'); // to deal with url in node
const fs = require('fs'); // to deal with file system (create dir)
const glob = require('glob'); // for matching file
const path = require('path');

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

// launch function
if (argv.url !== undefined) {
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
        const recentReportContents = (() => {
            const output = fs.readFileSync(
                dirName + "/" + recentReport.replace(/:/g, "_") + ".json",
                "utf8",
                (err, results) => {
                  return results;
                }
              );
              return JSON.parse(output);
        })();
                
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

    const compareReports = (from, to) => {
        console.log(from["finalUrl"] + " " + from["fetchTime"]);
        console.log(to["finalUrl"] + " " + to["fetchTime"]);
    };

} else {
    throw "You haven't passed a URL to Lighthouse"
};

