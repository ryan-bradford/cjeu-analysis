const fs = require('fs')
const csv = require('csv-parser');
const copyfind = require('./pl-copyfind')
var xlsx = require('node-xlsx');

var options = {
    PhraseLength: 6, WordThreshold: 100, bIgnoreCase: true,
    bIgnoreNumbers: true, bIgnoreOuterPunctuation: true, bSkipNonwords: true
};

var obj = xlsx.parse('test.xlsx'); // parses a file


let allRows = [];

let output = '';

Promise.all(obj[0].data.map((row, i) => {
    return copyfindPromise(row[3], row[4]).then(result => {
        return [row[1], result];
    }).catch(error => {
        console.log(`Row ${i} empty because there was no data`);
        return ["No Data", "No data"];
    })
})).then(result => {
    result.map(row => {
        output += row[1] + '\n';
    })
    fs.writeFileSync('out.csv', output);
});

/*Promise.all([getData('test1.txt', "utf8"), getData('test2.txt', "utf8")]).then(([a, b]) => {
    copyfindPromise(a, b).then(copyresult => {
        console.log(copyresult);
    })
})*/

function getData(fileName, type) {
    return new Promise(function (resolve, reject) {
        fs.readFile(fileName, type, (err, data) => {
            err ? reject(err) : resolve(data);
        });
    });
}

function copyfindPromise(text1, text2) {
    return new Promise(function (resolve, reject) {
        copyfind(text1, text2, options, function (err, data) {
            err ? reject(err) : resolve(data.i.MatchingWordsTotalR / data.hashesL[0].WordsTotal);
        });
    });
}