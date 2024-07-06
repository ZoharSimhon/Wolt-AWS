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
        // USE_CACHE: USE_CACHE
    };
    res.send(response);
});

// Adding a Restaurant
app.post('/restaurants', async (req, res) => {
    const restaurant = req.body;
    const cacheKey = `Restaurant-${restaurant.name}`;

    const item = {
        Cuisine: restaurant.cuisine,
        UniqueName: restaurant.name,
        GeoRegion: restaurant.region,
        Rating: restaurant.rating || 0,
        RatingCount: restaurant.rating ? 1 : 0
    }

    const params = {
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(UniqueName)'
    };

    try {
        await dynamodb.put(params).promise();
        if (USE_CACHE) {
            await memcachedActions.addRestaurants(cacheKey, item);
            // await memcachedActions.addRestaurants(cacheKey, req.body);
        }
        res.status(200).send({ success: true });
    } catch (err) {
        if (err.code === 'ConditionalCheckFailedException') {
            res.status(409).send({ success: false, message: 'Restaurant already exists' });
        } else {
            res.status(500).send({ success: false, message: "Error adding restaurant: " + err.message });
        }
    }

    // Students TODO: Implement the logic to add a restaurant
    // res.status(404).send("need to implement");
});

// Getting a Restaurant by Name
app.get('/restaurants/:restaurantName', async (req, res) => {
    const restaurantName = req.params.restaurantName;
    const cacheKey = `Restaurant-${restaurantName}`;

    if (USE_CACHE) {
        const cachedData = await memcachedActions.getRestaurants(cacheKey);
        if (cachedData) {
            const restaurant = {
                name: cachedData.UniqueName,
                region: cachedData.GeoRegion,
                cuisine: cachedData.Cuisine,
                rating: cachedData.Rating
            };
            return res.status(200).send(restaurant); //CHANGE
        }
    }

    const params = {
        TableName: TABLE_NAME,
        Key: {
            UniqueName: restaurantName
        }
    };

    try {
        const result = await dynamodb.get(params).promise();
        if (result.Item) {
            const restaurant = {
                name: result.Item.UniqueName,
                region: result.Item.GeoRegion,
                cuisine: result.Item.Cuisine,
                rating: result.Item.Rating
            };

            if (USE_CACHE) {
                await memcachedActions.addRestaurants(cacheKey, restaurant);
            }

            res.status(200).send(restaurant);
        } else {
            res.status(404).send({ success: false, message: "Restaurant not found" });
        }
    } catch (err) {
        res.status(500).send({ success: false, message: "Error getting restaurant: " + err.message });
    }

    // Students TODO: Implement the logic to get a restaurant by name
    // res.status(404).send("need to implement");
});

// Deleting a Restaurant by Name
app.delete('/restaurants/:restaurantName', async (req, res) => {
    const restaurantName = req.params.restaurantName;
    const cacheKey = `Restaurant-${restaurantName}`;

    const params = {
        TableName: TABLE_NAME,
        Key: {
            UniqueName: restaurantName
        }
    };

    try {
        await dynamodb.delete(params).promise();
        res.send({ success: true });
    } catch (err) {
        res.status(500).send({ success: false, message: "Error deleting restaurant: " + err.message });
    }

    // Invalidate cache
    if (USE_CACHE) {
        await memcachedActions.deleteRestaurants(cacheKey);
    }

    // Students TODO: Implement the logic to delete a restaurant by name
    // res.status(404).send("need to implement");
});

// Adding a Rating to a Restaurant
app.post('/restaurants/rating', async (req, res) => {
    const restaurantName = req.body.name;
    const rating = req.body.rating;
    const cacheKey = `Restaurant-${restaurantName}`;

    const getParams = {
        TableName: TABLE_NAME,
        Key: {
            UniqueName: restaurantName
        }
    };

    try {
        const result = await dynamodb.get(getParams).promise();
        if (!result.Item) {
            return res.status(404).send({ success: false, message: "Restaurant not found" });
        }

        let newRating = (result.Item.Rating * result.Item.RatingCount + rating) / (result.Item.RatingCount + 1);
        let newRatingCount = result.Item.RatingCount + 1;

        const updateParams = {
            TableName: TABLE_NAME,
            Key: {
                UniqueName: restaurantName
            },
            UpdateExpression: "set Rating = :r, RatingCount = :rc",
            ExpressionAttributeValues: {
                ":r": newRating,
                ":rc": newRatingCount
            },
            ReturnValues: "UPDATED_NEW"
        };

        await dynamodb.update(updateParams).promise();

        // Invalidate cache
        if (USE_CACHE) {
            await memcachedActions.deleteRestaurants(cacheKey);
        }

        res.send({ success: true });
    } catch (err) {
        res.status(500).send({ success: false, message: "Error updating rating: " + err.message });
    }

    // Students TODO: Implement the logic to add a rating to a restaurant
    // res.status(404).send("need to implement");
});

// Getting Top Rated Restaurants by Cuisine
app.get('/restaurants/cuisine/:cuisine', async (req, res) => {
    const cuisine = req.params.cuisine;
    let limit = parseInt(req.query.limit) || 10;
    if (limit > 100) limit = 100;

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
        const transformedItems = result.Items.map(item => ({
            name: item.UniqueName,
            region: item.GeoRegion,
            cuisine: item.Cuisine,
            rating: item.Rating
        }));
        res.status(200).send(transformedItems);
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
    if (limit > 100) limit = 100;

    const params = {
        TableName: TABLE_NAME,
        FilterExpression: 'GeoRegion = :region',
        ExpressionAttributeValues: {
            ':region': region
        },
        Limit: limit
    };

    try {
        const result = await dynamodb.scan(params).promise();
        const transformedItems = result.Items.map(item => ({
            name: item.UniqueName,
            region: item.GeoRegion,
            cuisine: item.Cuisine,
            rating: item.Rating
        }));
        res.status(200).send(transformedItems);
    } catch (err) {
        res.status(500).send({
            success: false,
            message: "Error getting restaurants by region: " + err.message
        });
    }

    // Students TODO: Implement the logic to get top rated restaurants by region
    // res.status(404).send("need to implement");
});

// Getting Top Rated Restaurants by Region and Cuisine
app.get('/restaurants/region/:region/cuisine/:cuisine', async (req, res) => {
    const region = req.params.region;
    const cuisine = req.params.cuisine;
    let limit = parseInt(req.query.limit) || 10;
    if (limit > 100) limit = 100;

    const params = {
        TableName: TABLE_NAME,
        IndexName: 'CuisineIndex', // Replace with your actual index name
        KeyConditionExpression: 'Cuisine = :cuisine',
        FilterExpression: 'GeoRegion = :region',
        ExpressionAttributeValues: {
            ':cuisine': cuisine,
            ':region': region
        },
        Limit: limit
    };

    try {
        const result = await dynamodb.query(params).promise();
        const transformedItems = result.Items.map(item => ({
            name: item.UniqueName,
            region: item.GeoRegion,
            cuisine: item.Cuisine,
            rating: item.Rating
        }));
        res.status(200).send(transformedItems);
    } catch (err) {
        res.status(500).send({ success: false, message: "Error getting restaurants by region and cuisine: " + err.message });
    }

    // Students TODO: Implement the logic to get top rated restaurants by region and cuisine
    // res.status(404).send("need to implement");
});

// app.listen(80, () => {
//     console.log('Server is running on http://localhost:80');
// });

module.exports = { app };