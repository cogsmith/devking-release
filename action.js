const fs = require('fs');

const semver = require('semver');

console.log( semver.inc('0.0.0-dev','patch') );

// process.exit();

console.log('ACTION');

console.log();

Object.keys(process.env).forEach(x => {
    // console.log(x); console.log(process.env[x]); console.log();
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

const { Octokit } = require("@octokit/rest");
const octokit = new Octokit();

// Compare: https://docs.github.com/en/rest/reference/repos/#list-organization-repositories
octokit.rest.repos.listForOrg({ org: "octokit", type: "public", }).then(({ data }) => {
    //console.log(data);
});