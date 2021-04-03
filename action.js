const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_REPONAME = GITHUB_REPOSITORY.split('/')[1];
const GITHUB_REPOTEAM = GITHUB_REPOSITORY.split('/')[0];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const _ = require('lodash');
const execa = require('execa');

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

        let card = { Number: 0, Note: x.note, Issue: 'INFO' };

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

            if (!card.Number) { card.Issue = 'INFO'; }
            if (!card.Issue) { card.Issue = 'ISSUE'; }
            if (!card.Topic) { card.Topic = null; }
        }

        console.log(card);
        cardlist.push(card);
    }

    console.log("\n\n\n\n");
    console.log(cardlist);
    console.log("\n\n\n\n");

    let msgz = {};

    let items = [];

    cardlist.forEach(x => { if (x.Number == 0) { items.push(x); } });

    let issueorder = 'SECURITY BREAKING CHANGE BUG FEATURE DEV TASK HOWTO NOTES'.split(' ');
    issueorder.forEach(x => {
        let xlist = _.orderBy(cardlist, ['Topic', 'Number']).filter(z => z.Issue === x);
        if (xlist) { xlist.forEach(zz => { items.push(zz); }); }
    });

    _.orderBy(cardlist, ['Topic', 'Number']).forEach(x => {
        if (x.Number == 0) { return; }
        if (issueorder.concat('ISSUE').includes(x.Issue)) { return; }
        items.push(x);
    });

    let x = 'ISSUE'; let xlist = _.orderBy(cardlist, ['Topic', 'Number']).filter(z => z.Issue === x);
    if (xlist) { xlist.forEach(zz => { items.push(zz); }); }

    let itemdb = {};
    items.forEach(x => {
        if (!itemdb[x.Issue]) { itemdb[x.Issue] = []; }
        itemdb[x.Issue].push(x);
    });

    //console.log("\n\n");
    //console.log(itemdb);

    //console.log("\n\n");
    //console.log(items);

    console.log("\n\n");
    console.log(App.GetLogTXT(itemdb));

    console.log("\n\n");
    console.log(App.GetLogMD(itemdb));

    //console.log("\n\n");
    //console.log(msgz);

}

App.GetLogTXT = function (itemdb) {
    let txt = [];
    txt.push('# 0.0.0 @ 2099-12-31'); txt.push(null);
    Object.keys(itemdb).forEach(k => {
        txt.push('## ' + k); // txt.push(null);
        itemdb[k].forEach(z => {
            let line = '';
            if (z.Topic) { line += z.Topic + ': '; }
            if (z.Number != 0) { line += '#' + z.Number + ': '; }
            line += z.Note;
            txt.push(line);
        });
        txt.push(null);
    });
    return txt.join("\n");
}

App.GetLogMD = function (itemdb) {
    let txt = [];
    txt.push('<code>'); txt.push(null);
    txt.push('# [0.0.0 @ 2099-12-31](https://github.com/' + GITHUB_REPOTEAM + '/' + GITHUB_REPONAME + '/releases/tag/' + '0.0.0' + ')');
    Object.keys(itemdb).forEach(k => {
        txt.push(null); txt.push('---'); txt.push(null);
        txt.push('## ' + k); // txt.push(null);
        itemdb[k].forEach(z => {
            let line = '- ';
            if (z.Number != 0) {
                if (z.Topic) { line += '<b>' + z.Topic + '</b>' + ': '; }
                line += '[';
                if (z.Number != 0) { line += '#' + z.Number + ': '; }
                line += z.Note;
                line += ']';
                line += '(' + 'https://github.com/' + GITHUB_REPOTEAM + '/' + GITHUB_REPONAME + '/issues/' + z.Number + ')';
            }
            else {
                if (z.Topic) { line += '<b>' + z.Topic + '</b>' + ': '; }
                line += z.Note;
            }
            txt.push(line);
        });
    });
    txt.push(null);
    txt.push('</code>');
    return txt.join("\n");
}

App.FXFX = async function () { await App.FX(); };

App.FXFX();

execa.commandSync('date >> dt.txt',{shell:true});
execa.commandSync(' npm version patch --no-git-tag-version ; npm version patch --no-git-tag-version',{shell:true});
execa.commandSync('git config user.name DEVKING');
execa.commandSync('git config user.email devkingbot@cogsmith.com');
// execa.commandSync('echo ' + GITHUB_TOKEN + ' | gh auth login --with-token',{shell:true});
execa.commandSync('gh release create 9.9.9 --target main');
execa.commandSync('git add .');
execa.commandSync("git commit -m 'DT'");
execa.commandSync('git push');
