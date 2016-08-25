const cluster = require('cluster');
const path = require('path');

// this is the path to the cluster worker that spawns the http server
const workerPath = path.join(__dirname, 'cluster-worker.js');

// we need to do some special things for coverages
if (process.env.running_under_istanbul) {
  // use coverage for forked process
  // disabled reporting and output for child process
  // enable pid in child process coverage filename
  cluster.setupMaster({
    exec: './node_modules/.bin/istanbul',
    args: [
      'cover',
      '--report', 'none',
      '--print', 'none',
      // output files will have the workers PID in the filename
      '--include-pid',
      workerPath,
      '--',
    ]
    // append any additional command line arguments
    .concat(process.argv.slice(2)),
  });
} else {
  // normal forking
  cluster.setupMaster({
    exec: workerPath,
  });
}

// for each worker created...
cluster.on('fork', (worker) => {
  // wait for the worker to send a message
  worker.on('message', (request) => {
    if (request === 'hi') {
      worker.send('hello');
    }
  });
});

// fork a new worker
cluster.fork();
cluster.fork();

let isDone = false;

// provide a function for mocha so we can call back when the worker is ready
module.exports = (done) => {
  // fire when a new worker is forked
  cluster.on('fork', (worker) => {
    // fire when the worker is ready for new connections
    worker.on('listening', () => {
      // tell mocha we are good to go
      if (!isDone) {
        isDone = true;
        done();
      }
    });
  });
};
