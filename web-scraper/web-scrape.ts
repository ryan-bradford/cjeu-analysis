import * as request from "request-promise-native";
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-style';
import * as fs from 'fs';
import { JSDOM } from 'jsdom';


/**
 * QUESTIONS:
 * 
 * PDF or HTML or TEXT?
 * What is CJEU?
 */
const ORGS_TO_PULL: [string, string] = ['advGeneral', 'judgment'];

const BASE_URL = 'https://eur-lex.europa.eu';
const YEARS = [2019, 2018];

run();

function buildAndWriteCSV(clexToAG, clexToJustice, year: number) {
    let data = [];
    clexToAG.forEach((value, key) => {
        const ag = clexToAG.get(key) as string;
        const ecj = clexToJustice.get(key) as string;
        if (ag === undefined || ecj === undefined || ag.substring(0, 4) === 'null' || ecj.substring(0, 4) === 'null') {
            return;
        }
        data.push([
            key,
            "",
            "",
            ag.replace(/(\r\n|\n|\r)/gm, ""),
            ecj.replace(/(\r\n|\n|\r)/gm, ""),
        ])
    })

    console.log(data.length + ' records written to disk for the year of ' + year);

    const wb = XLSX.utils.book_new();

    wb.Props = {
        Title: "Webscraper Output",
        Subject: "CJEU",
        Author: "Ryan Bradford",
        CreatedDate: new Date()
    };

    wb.SheetNames.push("Data Sheet");
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [
        {
            wpx: 300,
        },
        {
            wpx: 300,
        },
        {
            wpx: 300,
        },
    ]

    ws["!rows"] = []

    for (let row = 1; row <= data.length; row++) {
        ws["!rows"].push({
            hpx: 200,
        });
    }
    wb.Sheets["Data Sheet"] = ws;

    for (let row = 1; row <= data.length; row++) {
        for (let col of ['A', 'B', 'C']) {
            ws[`${col}${row}`].s = {
                alignment: {
                    wrapText: true, // any truthy value here,
                    vertical: 'top',
                },
            }
        }
    }
    XLSXStyle.writeFile(wb, `${year}.xlsx`);

    return;
}

// console.log(generateSearchURL(1, ORGS_TO_PULL[1], 2019));

function run() {
    return Promise.all(YEARS.map(async (year) => {
        const result = await Promise.all(ORGS_TO_PULL.map((group) => {
            return writeOpinionsToDiskForYearGroup(year, group);
        }))
        await buildAndWriteCSV(result[0], result[1], year);
    }));
}

async function writeOpinionsToDiskForYearGroup(year: number, group: string): Promise<Map<string, string>> {
    const pageOneHTML = await pullHtml(generateSearchURL(1, group, year))
    const totalPages = getTotalPages(new JSDOM(pageOneHTML));
    const toReturn = [];
    let map = new Map<string, string>();
    for (var pageCount = 1; pageCount <= totalPages; pageCount++) {
        toReturn.push((async (pageNum: number, curYear: number) => {
            const newSearchURL = generateSearchURL(pageNum, group, curYear);
            const pageHTML = new JSDOM(await pullHtml(newSearchURL));
            const clexTags = getAllCLEXTags(pageHTML);
            return Promise.all(clexTags.map(async tag => {
                if (group === ORGS_TO_PULL[0]) {
                    map.set(tag.substring(7), await getOpinionFromCLEXTag(tag));
                } else {
                    map.set(tag.substring(7), await getOpinionFromCLEXTag(tag));
                }
            }))
        })(pageCount, year));
    }
    await Promise.all(toReturn);
    return map;
}


/**
 * Returns the HTML text from the opinion page.
 * 
 * @works
 */
async function getOpinionFromCLEXTag(clex: string): Promise<string> {
    return domToText(new JSDOM(await pullHtml(generateLegalContentURL(clex))));
}

function domToText(dom: JSDOM): string {
    let out = '';
    dom.window.document.childNodes.forEach((node) => {
        out += nodeToText(node);
    })
    return out;
}

function nodeToText(node: ChildNode): string {
    let out = '';
    out += node.textContent;
    node.childNodes.forEach((child) => {
        out += nodeToText(child);
    })
    return out;
}


/**
 * Returns all the CLEX tgs for all the opinion pages.
 * 
 * @works
 */
function getAllCLEXTags(resultHtml: JSDOM): string[] {
    const toReturn = [];
    const searches = resultHtml.window.document.getElementsByClassName('SearchResult');
    for (var i = 0; i < searches.length; i++) {
        const item = searches[i];
        toReturn.push(item.getElementsByTagName('a')[0].href.split('CELEX:')[1].split('&')[0]);
    }
    return toReturn;
}


/**
 * Gives the total page count in the document.
 * 
 * @works
 */
function getTotalPages(resultHtml: JSDOM): number {
    const allAnchors = resultHtml.window.document.getElementsByTagName('a');
    for (var i = 0; i < allAnchors.length; i++) {
        const item = allAnchors[i];
        if (item.title.includes('Last Page')) {
            return Number(item.href.split('page=')[1]);
        }
    }
    return 1;
}

/**
 * Returns the URL that will bring you to the search page for the results.
 */
function generateSearchURL(page: number, group: string, year: number): string {
    return `https://eur-lex.europa.eu/search.html?or0=DTT%3DC?&DTA=${year}&qid=1578841865861&DB_TYPE_OF_ACT=${group}&CASE_LAW_SUMMARY=false&DTS_DOM=EU_LAW&type=advanced&DTS=6&DTS_SUBDOM=EU_CASE_LAW&page=${page}`
}


/**
 * Gives the legal content URL based on the clex tag.
 */
function generateLegalContentURL(clex: string) {
    return `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${clex}&from=EN`;
}


async function pullHtml(link: string): Promise<string> {
    var options = {
        uri: link,
    };

    return await request.get(options).catch((error) => {
    })
}

