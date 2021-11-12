const express = require('express')

const admin = require("firebase-admin");

const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;

const cors = require('cors')
require('dotenv').config()

const app = express()
const port = process.env.PORT || 5000

// car-warrior-sumon6638-adminsdk.json
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yi4wr.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            // check who want to make someone as admin --> store his(who want to try make other admin) mail address in decodedEmail
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}

async function run() {
    try {
        await client.connect();
        // console.log('database connected');

        const database = client.db('car_warrior')
        const productsCollection = database.collection('products');
        const blogsCollection = database.collection('blogs');
        const reviewsCollection = database.collection('reviews');
        const purchasesCollection = database.collection('purchases');
        const usersCollection = database.collection('users');

        app.get('/productsLimit', async (req, res) => {
            const cursor = productsCollection.find({}).limit(6);

            const products = await cursor.toArray();
            res.json(products);
        })

        app.get('/products', async (req, res) => {
            const cursor = productsCollection.find({});

            const products = await cursor.toArray();
            res.json(products);
        })

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await productsCollection.findOne(query);
            res.json(product);
        })

        app.get('/blogs', async (req, res) => {
            const cursor = blogsCollection.find({});

            const blogs = await cursor.toArray();
            res.json(blogs);
        })

        app.get('/reviews', async (req, res) => {
            const cursor = reviewsCollection.find({});

            const reviews = await cursor.toArray();
            res.json(reviews);
        })

        app.get('/myOrders/:email', async (req, res) => {
            const cursor = purchasesCollection.find({ email: req.params.email });

            const myOrder = await cursor.toArray();
            res.json(myOrder);
        })

        app.get('/orders', async (req, res) => {
            const cursor = purchasesCollection.find({});

            const orders = await cursor.toArray();
            res.json(orders);
        })

        app.post('/purchases', async (req, res) => {
            const purchase = req.body;

            const result = await purchasesCollection.insertOne(purchase);
            res.json(result);
        })

        app.post('/products', async (req, res) => {
            const product = req.body;

            const result = await productsCollection.insertOne(product);
            res.json(result);
        })

        app.post('/reviews', async (req, res) => {
            const review = req.body;

            const result = await reviewsCollection.insertOne(review);
            res.json(result);
        })

        app.put('/products/:id', async (req, res) => {
            const id = req.params.id;
            const updatedAction = req.body;

            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    name: updatedAction.name,
                    price: updatedAction.price
                },
            };

            const result = await productsCollection.updateOne(filter, updateDoc, options)
            res.json(result);
        })

        app.put("/orders/:id", async (req, res) => {
            const filter = { _id: ObjectId(req.params.id) };

            const result = await purchasesCollection.updateOne(filter, {
                $set: {
                    status: req.body.status,
                },
            });
            res.send(result);
        });

        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.json(result);
        })

        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await purchasesCollection.deleteOne(query);
            res.json(result);
        })

        // Backend Functionality for admin && user maintenance

        // check an user is he/she admin or not
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        // add user in my db
        app.post('/users', async (req, res) => {
            const user = req.body;

            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        })

        // add user by upsert( update & insert ) method
        app.put('/users', async (req, res) => {
            const user = req.body;

            // check is this user already registered?
            const filter = { email: user.email };

            // this option instructs the method to create a document if no documents match the filter
            const options = { upsert: true };

            const updateDoc = { $set: user };

            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        })

        // app.put('/users/:id') --> update user by specific id/email
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            // console.log('put', req.decodedEmail);
            const requester = req.decodedEmail; // who want to try someone make admin

            if (requester) {
                // at first find this user from my database
                const requesterAccount = await usersCollection.findOne({ email: requester });

                // now check is his role is admin or not in my db
                if (requesterAccount.role === 'admin') {
                    // if his role is admin then he can add someone as admin

                    // find this user which we want to make admin
                    const filter = { email: user.email }

                    // update this user...
                    const updateDoc = { $set: { role: 'admin' } };

                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' });
            }
        })
    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir)

app.get('/', (req, res) => {
    console.log(req);
    res.send('Car Warrior!')
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})