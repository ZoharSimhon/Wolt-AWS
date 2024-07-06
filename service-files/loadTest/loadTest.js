const axios = require('axios');
const async = require('async');
const http = require('http');

// HTTP and HTTPS agents
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: Infinity });

// Configuration
const endpoint = 'http://Restau-LB8A1-6vzrhRbUKcQa-1820615568.us-east-1.elb.amazonaws.com'; // Set your endpoint URL here
const requestCount = 1000; // Total number of requests to send

// Function to generate a unique restaurant name
const generateSequentialName = (index) => {
    return `Restaurant-${index}`;
};

// Function to make an HTTP GET request
const makeGetRequest = (path, done) => {
    const startTime = Date.now();
    axios.get(`${endpoint}${path}`, {
        httpAgent,
    })
        .then(response => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.log(`GET ${path} - Response status: ${response.status}, Time Taken: ${duration} ms`);
            done(null, duration);
        })
        .catch(error => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.error(`GET ${path} - Error: ${error.response ? error.response.status : error.message}, Time Taken: ${duration} ms`);
            done(error, duration);
        });
};

// Function to make an HTTP POST request
const makePostRequest = (path, data, done) => {
    const startTime = Date.now();
    axios.post(`${endpoint}${path}`, data, {
        httpAgent,
    })
        .then(response => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.log(`POST ${path} - Response status: ${response.status}, Time Taken: ${duration} ms`);
            done(null, duration);
        })
        .catch(error => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.error(`POST ${path} - Error: ${error.response ? error.response.status : error.message}, Time Taken: ${duration} ms`);
            done(error, duration);
        });
};

// Function to make an HTTP DELETE request
const makeDeleteRequest = (path, done) => {
    const startTime = Date.now();
    axios.delete(`${endpoint}${path}`, {
        httpAgent,
    })
        .then(response => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.log(`DELETE ${path} - Response status: ${response.status}, Time Taken: ${duration} ms`);
            done(null, duration);
        })
        .catch(error => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.error(`DELETE ${path} - Error: ${error.response ? error.response.status : error.message}, Time Taken: ${duration} ms`);
            done(error, duration);
        });
};

// Main function to perform the load test sequentially
const loadTest = () => {
    const tasks = [];

    for (let i = 1; i <= requestCount; i++) {
        const uniqueName = generateSequentialName(i);
        const restaurantData = {
            name: uniqueName,
            region: 'North',
            cuisine: 'Italian',
            rating: 4.5
        };

        tasks.push(done => makePostRequest('/restaurants', restaurantData, done));
        tasks.push(done => makeGetRequest(`/restaurants/${uniqueName}`, done));
        tasks.push(done => makeGetRequest(`/restaurants/${uniqueName}`, done));
    }

    async.series(tasks, (err, results) => {
        if (err) {
            console.error('A request failed:', err);
        } else {
            console.log('All requests completed successfully.');
            const totalDuration = results.reduce((total, current) => total + current, 0);
            const averageDuration = totalDuration / results.length;
            console.log('Average Request Time:', averageDuration, 'ms');
            
            // Cleanup function to delete all created restaurants
            const cleanupTasks = [];
            for (let i = 1; i <= requestCount; i++) {
                const uniqueName = generateSequentialName(i);
                cleanupTasks.push(done => makeDeleteRequest(`/restaurants/${uniqueName}`, done));
            }
            
            async.series(cleanupTasks, (cleanupErr, cleanupResults) => {
                if (cleanupErr) {
                    console.error('A cleanup request failed:', cleanupErr);
                } else {
                    console.log('All cleanup requests completed successfully.');
                }
            });
        }
    });
};

// Start the load testing
loadTest();
