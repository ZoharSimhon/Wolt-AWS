const express = require('express');
const RestaurantsMemcachedActions = require('./model/restaurantsMemcachedActions');

const app = express();
app.use(express.json());

const MEMCACHED_CONFIGURATION_ENDPOINT = process.env.MEMCACHED_CONFIGURATION_ENDPOINT;
const TABLE_NAME = process.env.TABLE_NAME;
const AWS_REGION = process.env.AWS_REGION;
const USE_CACHE = process.env.USE_CACHE === 'true';

const memcachedActions = new RestaurantsMemcachedActions(MEMCACHED_CONFIGURATION_ENDPOINT);

// Set up the DynamoDB client
const AWS = require('aws-sdk');
AWS.config.update({ region: AWS_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();

app.get('/', (req, res) => {
    const response = {
        MEMCACHED_CONFIGURATION_ENDPOINT: MEMCACHED_CONFIGURATION_ENDPOINT,
        TABLE_NAME: TABLE_NAME,
        AWS_REGION: AWS_REGION,
        USE_CACHE: USE_CACHE
    };
    res.send(response);
});

// Adding a Restaurant
app.post('/restaurants', async (req, res) => {
    const restaurant = req.body;

    const params = {
        TableName: TABLE_NAME,
        Item: {
            UniqueName: restaurant.uniqueName,
            GeoRegion: restaurant.geoRegion,
            Rating: restaurant.rating,
            Cuisine: restaurant.cuisine
        },
        ConditionExpression: 'attribute_not_exists(UniqueName)'
    };

    try {
        await dynamodb.put(params).promise();
        res.status(201).send("Restaurant added successfully");
    } catch (err) {
        res.status(500).send("Error adding restaurant: " + err.message);
    }

    // Students TODO: Implement the logic to add a restaurant
    // res.status(404).send("need to implement");
});

// Getting a Restaurant by Name
app.get('/restaurants/:restaurantName', async (req, res) => {
    const restaurantName = req.params.restaurantName;

    const params = {
        TableName: TABLE_NAME,
        Key: {
            UniqueName: restaurantName
        }
    };

    try {
        const result = await dynamodb.get(params).promise();
        if (result.Item) {
            res.send(result.Item);
        } else {
            res.status(404).send("Restaurant not found");
        }
    } catch (err) {
        res.status(500).send("Error getting restaurant: " + err.message);
    }

    // Students TODO: Implement the logic to get a restaurant by name
    // res.status(404).send("need to implement");
});

// Deleting a Restaurant by Name
app.delete('/restaurants/:restaurantName', async (req, res) => {
    const restaurantName = req.params.restaurantName;
    
    const params = {
        TableName: TABLE_NAME,
        Key: {
            UniqueName: restaurantName
        }
    };

    try {
        await dynamodb.delete(params).promise();
        res.send("Restaurant deleted successfully");
    } catch (err) {
        res.status(500).send("Error deleting restaurant: " + err.message);
    }

    // Students TODO: Implement the logic to delete a restaurant by name
    // res.status(404).send("need to implement");
});

// Adding a Rating to a Restaurant
app.post('/restaurants/rating', async (req, res) => {
    const restaurantName = req.body.name;
    const rating = req.body.rating;
    

    const getParams = {
        TableName: TABLE_NAME,
        Key: {
            UniqueName: restaurantName
        }
    };

    try {
        const result = await dynamodb.get(getParams).promise();
        if (!result.Item) {
            return res.status(404).send("Restaurant not found");
        }

        let newRating = (result.Item.Rating + rating) / 2;

        const updateParams = {
            TableName: TABLE_NAME,
            Key: {
                UniqueName: restaurantName
            },
            UpdateExpression: "set Rating = :r",
            ExpressionAttributeValues: {
                ":r": newRating
            },
            ReturnValues: "UPDATED_NEW"
        };

        await dynamodb.update(updateParams).promise();
        res.send("Rating updated successfully");
    } catch (err) {
        res.status(500).send("Error updating rating: " + err.message);
    }

    // Students TODO: Implement the logic to add a rating to a restaurant
    // res.status(404).send("need to implement");
});

// Getting Top Rated Restaurants by Cuisine
app.get('/restaurants/cuisine/:cuisine', async (req, res) => {
    const cuisine = req.params.cuisine;
    let limit = parseInt(req.query.limit) || 10;

    const params = {
        TableName: TABLE_NAME,
        IndexName: 'CuisineIndex',
        KeyConditionExpression: 'Cuisine = :cuisine',
        ExpressionAttributeValues: {
            ':cuisine': cuisine
        },
        Limit: limit,
        ScanIndexForward: false // Descending order by rating
    };

    try {
        const result = await dynamodb.query(params).promise();
        res.send(result.Items);
    } catch (err) {
        res.status(500).send("Error getting restaurants by cuisine: " + err.message);
    }
    
    // Students TODO: Implement the logic to get top rated restaurants by cuisine
    // res.status(404).send("need to implement");
});

// Getting Top Rated Restaurants by Region
app.get('/restaurants/region/:region', async (req, res) => {
    const region = req.params.region;
    let limit = parseInt(req.query.limit) || 10;

    const params = {
        TableName: TABLE_NAME,
        IndexName: 'GeoRegionIndex',
        KeyConditionExpression: 'GeoRegion = :region',
        ExpressionAttributeValues: {
            ':region': region
        },
        Limit: limit,
        ScanIndexForward: false // Descending order by rating
    };

    try {
        const result = await dynamodb.query(params).promise();
        res.send(result.Items);
    } catch (err) {
        res.status(500).send("Error getting restaurants by region: " + err.message);
    }
    
    // Students TODO: Implement the logic to get top rated restaurants by region
    // res.status(404).send("need to implement");
});

// Getting Top Rated Restaurants by Region and Cuisine
app.get('/restaurants/region/:region/cuisine/:cuisine', async (req, res) => {
    const region = req.params.region;
    const cuisine = req.params.cuisine;
    let limit = parseInt(req.query.limit) || 10;
    
    const params = {
        TableName: TABLE_NAME,
        IndexName: 'GeoRegionCuisineIndex',
        KeyConditionExpression: 'GeoRegion = :region and Cuisine = :cuisine',
        ExpressionAttributeValues: {
            ':region': region,
            ':cuisine': cuisine
        },
        Limit: limit,
        ScanIndexForward: false // Descending order by rating
    };

    try {
        const result = await dynamodb.query(params).promise();
        res.send(result.Items);
    } catch (err) {
        res.status(500).send("Error getting restaurants by region and cuisine: " + err.message);
    }

    // Students TODO: Implement the logic to get top rated restaurants by region and cuisine
    // res.status(404).send("need to implement");
});

app.listen(80, () => {
    console.log('Server is running on http://localhost:80');
});

module.exports = { app };