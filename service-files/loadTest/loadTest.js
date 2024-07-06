const axios = require('axios');
const async = require('async');
const http = require('http');

// HTTP and HTTPS agents
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: Infinity });

// Configuration
const endpoint = 'http://Restau-LB8A1-v9We7LCm9VbH-1456625015.us-east-1.elb.amazonaws.com'; // Set your endpoint URL here
const createCount = 10; // Number of restaurants to create
const requestCount = 10000; // Total number of GET requests to send
const concurrencyLevel = 4; // Number of concurrent requests, adjust based on system capacity

// Function to generate a unique restaurant name
const generateSequentialName = (index) => {
    return `Restaurant2-${index}`;
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

// Main function to perform the load test in parallel
const loadTest = () => {
    const createTasks = [];
    const uniqueNames = [];

    // Create restaurants
    for (let i = 1; i <= createCount; i++) {
        const uniqueName = generateSequentialName(i);
        uniqueNames.push(uniqueName);
        const restaurantData = {
            name: uniqueName,
            region: 'North',
            cuisine: 'Italian',
            rating: 4.5
        };
        createTasks.push(done => makePostRequest('/restaurants', restaurantData, done));
    }

    // Execute creation tasks in parallel
    async.parallelLimit(createTasks, concurrencyLevel, (createErr) => {
        if (createErr) {
            console.error('A creation request failed:', createErr);
        } else {
            console.log('All creation requests completed successfully.');

            const getTasks = [];

            // Request restaurants multiple times
            for (let i = 0; i < requestCount; i++) {
                const uniqueName = uniqueNames[i % createCount];
                getTasks.push(done => makeGetRequest(`/restaurants/${uniqueName}`, done));
                getTasks.push(done => makeGetRequest(`/restaurants/${uniqueName}`, done));
                getTasks.push(done => makeGetRequest(`/restaurants/${uniqueName}`, done));
            }

            // Execute GET requests in parallel
            async.parallelLimit(getTasks, concurrencyLevel, (getErr, getResults) => {
                if (getErr) {
                    console.error('A GET request failed:', getErr);
                } else {
                    console.log('All GET requests completed successfully.');
                    const totalDuration = getResults.reduce((total, current) => total + current, 0);
                    const averageDuration = totalDuration / getResults.length;
                    console.log('Average Request Time:', averageDuration, 'ms');

                    // Cleanup function to delete all created restaurants
                    const cleanupTasks = [];
                    uniqueNames.forEach(uniqueName => {
                        cleanupTasks.push(done => makeDeleteRequest(`/restaurants/${uniqueName}`, done));
                    });

                    async.parallelLimit(cleanupTasks, concurrencyLevel, (cleanupErr) => {
                        if (cleanupErr) {
                            console.error('A cleanup request failed:', cleanupErr);
                        } else {
                            console.log('All cleanup requests completed successfully.');
                        }
                    });
                }
            });
        }
    });
};

// Start the load testing
loadTest();
