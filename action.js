const fs = require('fs');

console.log('ACTION');

console.log();

Object.keys(process.env).forEach(x=>{
  // console.log(x); console.log(process.env[x]); console.log();
});

const AppPackage = require('./package.json');
//console.log(AppPackage);

if (!AppPackage.version) { AppPackage.version='0.0.0'; }

fs.writeFileSync('./package.json',JSON.stringify(AppPackage));

const { Octokit } = require("@octokit/rest");
const octokit = new Octokit();

// Compare: https://docs.github.com/en/rest/reference/repos/#list-organization-repositories
octokit.rest.repos.listForOrg({org: "octokit",type: "public",}).then(({ data }) => {
    //console.log(data);
});