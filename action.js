const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_REPONAME = GITHUB_REPOSITORY.split('/')[1];
const GITHUB_REPOTEAM = GITHUB_REPOSITORY.split('/')[0];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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
    let cz = await octokit.rest.projects.listColumns({ project_id: p.id });
    console.log(cz);
    cz.data.forEach(x => {
        colz[x.id] = x;
        colz[x.name] = x;
    });
    console.log(colz);

    let cards = await octokit.rest.projects.listCards({ column_id: colz['DONE'].id });
    console.log(cards);

    cards.data.forEach(await function (x) {
        if (x.content_url) {
            let inum = x.content_url.split('/').pop();
            let issue = await octokit.rest.issues.get({ owner: GITHUB_REPOTEAM, repo: GITHUB_REPONAME, issue_number: inum });
            console.log(issue);
        }
    });

};

App.FX();