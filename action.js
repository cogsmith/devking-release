const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_REPONAME = GITHUB_REPOSITORY.split('/')[1];
const GITHUB_REPOTEAM = GITHUB_REPOSITORY.split('/')[0];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const _ = require('lodash');

const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: GITHUB_TOKEN });

const fs = require('fs');

const semver = require('semver');

console.log(semver.inc('0.0.0-dev', 'patch'));

// process.exit();

console.log('ACTION');

console.log();

Object.keys(process.env).sort().forEach(x => { if (x.startsWith('GITHUB')) { console.log(x + ' = ' + process.env[x]); } });
console.log();

const AppPackageFile = process.cwd() + '/package.json';
const AppPackage = require(AppPackageFile);

console.log(AppPackage);

if (!AppPackage.version) { AppPackage.version = '0.0.0'; }

let vz = [AppPackage.version.split('-')[1]].concat(AppPackage.version.split('-')[0].split('.'));

let bumplevel = 'PATCH';

if (bumplevel == 'PATCH') { vz[3]++; }

AppPackage.version = vz.slice(1).join('.');

//if (vz[0]) { AppPackage.version += '-' + vz[0]; };

console.log(AppPackage);

fs.writeFileSync(AppPackageFile, JSON.stringify(AppPackage));

// Compare: https://docs.github.com/en/rest/reference/repos/#list-organization-repositories
octokit.rest.repos.listForOrg({ org: "octokit", type: "public", }).then(({ data }) => {
    //console.log(data);
});

let repo = { owner: GITHUB_REPOTEAM, repo: GITHUB_REPONAME };

const App = {};

App.FX = async function () {

    let p = false;
    let pz = await octokit.rest.projects.listForRepo(repo);
    p = pz.data.find(z => z.number === 1);

    let colz = {};
    let cz = await octokit.rest.projects.listColumns({ project_id: p.id }); // console.log(cz);
    cz.data.forEach(x => {
        colz[x.id] = x;
        colz[x.name] = x;
    });
    //console.log(colz);

    let cardlist = [];

    let gitcards = await octokit.rest.projects.listCards({ column_id: colz['DONE'].id }); // console.log(cards);
    for (let i = 0; i < gitcards.data.length; i++) {
        let gitcard = gitcards.data[i];
        let x = gitcard;

        let card = { Number: 0, Note: x.note };

        if (x.content_url) {
            let inum = parseInt(x.content_url.split('/').pop());

            let issue_ = await octokit.rest.issues.get({ owner: GITHUB_REPOTEAM, repo: GITHUB_REPONAME, issue_number: inum });
            let issue = issue_.data;
            //console.log(issue);

            //let labels = await octokit.rest.issues.listLabelsOnIssue({ owner: GITHUB_REPOTEAM, repo: GITHUB_REPONAME, issue_number: inum });
            //console.log(labels.data);

            let labels = []; if (issue.labels) { issue.labels.forEach(z => { labels.push(z.name) }); }
            card = { Number: inum, Note: issue.title, State: issue.state.toUpperCase(), Labels: labels };
            labels.forEach(z => {
                if (z.startsWith('ISSUE_')) { card.Issue = z.split('_')[1]; }
                if (z.startsWith('TOPIC_')) { card.Topic = z.split('_')[1]; }
                if (z.startsWith('STATUS_')) { card.Status = z.split('_')[1]; }
            });

            if (!card.Topic) { card.Topic = null; }
        }

        console.log(card);
        cardlist.push(card);
    }

    console.log("\n\n\n\n");
    console.log(cardlist);
    console.log("\n\n\n\n");

    let msgz = {};

    cardlist.forEach(x => { if (!msgz['INFO']) { msgz['INFO'] = []; } if (x.Number == 0) { msgz.INFO.push(x.Note); } });

    'SECURITY BUG FEATURE DEV TASK HOWTO NOTES'.split(' ').forEach(x=>{
        cardlist.find(z=>z.Topic===x).forEach(zz=>{ if (!msgz[x]) { msgz[x] = []; } msgz[x].push(zz.Note); });
    });
    
    
    _.orderBy(cardlist, ['Topic', 'Number']).forEach(x => {
        if (x.Number == 0) { return; }
        let msg = '';
        // if (x.Topic) { msg += x.Topic + ': '; }
        msg += '#' + x.Number + ': ';
        msg += x.Note;
        if (!msgz[x.Topic]) { msgz[x.Topic] = []; }; msgz[x.Topic].push(msg);
        console.log(msg);
    });
    
    console.log("\n\n");
    console.log(msgz);
    
    // SECURITY BUG REMOVED CHANGED FEATURE DEV TASK SUPPORT HOWTO NOTES
};

App.FX();