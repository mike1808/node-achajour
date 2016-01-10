'use strict';

const jsdom       = require('jsdom');
const exec        = require('child_process').exec;
const promisify   = require('es6-promisify');
const querystring = require('querystring');


let verbose = false;

const log = function log(msg) {
  if (verbose) {
    console.log(' ' + msg);
  }
};

const getDefaultGateway = function getDefaultGateway() {
  log('\nGetting default gateway...');

  return new Promise(function (resolve, reject) {
    exec("echo $(/sbin/ip route | awk '/default/ { print $3 }')", (err, stdout, stderr) => {
        if (err !== null) {
          return reject(err);
        }

        const gateway = stdout.toString().trim();

        log(`Default gateway is ${gateway}`);

        resolve(gateway);
      }
    );
  });

};

const getToken = function getToken(host) {
  log('\nFetching and parsing session token...');

  return promisify(jsdom.env.bind(jsdom))(host)
    .then(function (window) {
      const token = window.document.querySelector('form[action="/"] input[name="tok"]').value;

      log(`Session token is ${token}`);

      return token;
    });
};

const getStatus = function (host, token, voucher) {
  log('\nChecking voucher...');

  return promisify(jsdom.env.bind(jsdom))(host + '?' + querystring.stringify({
      tok: token,
      voucher,
      redir: 'localhost'
    }))
    .then(function (window) {
      const status = window.location.host === '';


      if (status) {
        log('We are successfully redirected to our given path. It means voucher is valid');
        return;
      }

      const errorNode = window.document.querySelectorAll('.error')[0];
      const message = errorNode && errorNode.innerHTML;

      log('Voucher is invalid');

      log(`Error message is:\t${message}`);

      throw new Error(message || 'Voucher is invalid');
    });
};

const login = function login(voucher, v) {
  let host;

  verbose = v;

  console.log('Please wait a few seconds...');

  return getDefaultGateway()
    .then((gateway) => {
      host = 'http://' + gateway;
      return getToken(host);
    })
    .then(function (token) {
      return getStatus(host, token, voucher);
    });
};

exports.login = login;

// fc:f8:ae:cc:22:43