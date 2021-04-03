const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_REPONAME = GITHUB_REPOSITORY.split('/')[0];
const GITHUB_REPOTEAM = GITHUB_REPOSITORY.split('/')[1];
const GITHUB_TOKEN = process.argv[2];
const GITHUB_REPOTOKEN = process.env.GITHUB_REPOTOKEN;

const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: GITHUB_TOKEN });

const fs = require('fs');

const semver = require('semver');

console.log(semver.inc('0.0.0-dev', 'patch'));

// process.exit();

console.log('ACTION');

console.log();

Object.keys(process.env).forEach(x => {
    if (x.startsWith('GITHUB')) { console.log(x); console.log(process.env[x]); console.log(); }
});

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

console.log('#');
console.log(repo);
console.log(GITHUB_TOKEN.substr(0,0));
console.log(GITHUB_REPOTOKEN.substr(0,9));
console.log('#');

const App = {};

App.FX = async function () {
    let p = false;
    let pz = await octokit.rest.projects.listForRepo(repo);
    //console.log(pz);
    pz.data.forEach(x => {
        // if (x.name.includes('-OVERVIEW') || x.number == 1) { p = x; }
        console.log(x);
    });
    //console.log(p);
};

App.FX();