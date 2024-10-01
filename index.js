const express = require('express')
const app = express()
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000

const corsOptions = {
    origin: [
        'http://localhost:5173',
        'http://localhost:5174'
    ],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())



// verify jwt middleware
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token
    if (!token) return res.status(401).send({ message: 'unauthorized access' })
    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.error('JWT Verification Error:', err);
                return res.status(401).send({ message: 'unauthorized access' })
            }
            console.log('Decoded Token:', decoded);

            req.user = decoded;
            next();
        });
    }
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8wqrrau.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const jobsCollection = client.db("soloSphere").collection("jobs");
        const bidsCollection = client.db("soloSphere").collection("bids");

        // jwt
        app.post('/jwt', async (req, res) => {
            const email = req.body;
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',

            }).send({ success: true });

        })
        // Clear token on logout
        app.get('/logout', (req, res) => {
            res
                .clearCookie('token', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    maxAge: 0,
                })
                .send({ success: true })
        })


        // post add job data
        app.post('/jobs', async (req, res) => {
            const jobdata = req.body;
            const result = await jobsCollection.insertOne(jobdata);
            res.send(result);

        })

        // get all jobs from database
        app.get('/jobs', async (req, res) => {
            const result = await jobsCollection.find().toArray();
            res.send(result)

        })
        // get single jobs
        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const result = await jobsCollection.findOne({ _id: new ObjectId(id) });
            res.send(result)
        })

        // get  jobs by email
        app.get('/jobs/email/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const tokenEmail = req.user.email;
            console.log(tokenEmail);

            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const result = await jobsCollection.find({ "buyer.buyeremail": email }).toArray();
            res.send(result)
        })
        // delete jobs  
        app.delete('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const result = await jobsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result)
        })
        // update jobs  
        app.put('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const jobData = req.body
            const option = { upsert: true }
            const updateData = {
                $set: {
                    ...jobData
                }
            }
            const result = await jobsCollection.updateOne({ _id: new ObjectId(id) }, updateData, option);
            res.send(result)
        })

        // post bids data
        app.post('/bids', async (req, res) => {
            const bidsdata = req.body;
            const { email, jobId } = bidsdata; // Assuming bidsdata contains user email and jobId

            // Check if the user has already placed a bid for this job
            const existingBid = await bidsCollection.findOne({ email: email, jobId: jobId });
            if (existingBid) {
                // If the user already placed a bid for this job, return an error message
                return res.status(400).send({ message: 'You have already placed a bid for this job.' });
            }

            // If no bid exists, insert the new bid
            const result = await bidsCollection.insertOne(bidsdata);
            res.send(result);

        })
        // get single bids by email in which bid
        app.get('/bids/:email', async (req, res) => {
            const email = req.params.email;
            const result = await bidsCollection.find({ email: email }).toArray();
            res.send(result)
        })
        // get all  bids requests fromm bd by for owner email 
        app.get('/bids-requests/:email', async (req, res) => {
            const email = req.params.email;
            const result = await bidsCollection.find({ "buyer.buyeremail": email }).toArray();
            res.send(result)
        })
        // update bid status
        app.patch('/bids/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body;
            const patchDoc = {
                $set: status
            }
            const result = await bidsCollection.updateOne({ _id: new ObjectId(id) }, patchDoc);
            res.send(result)

        })

        // pagination start

        // Get all jobs from the database with pagination
        app.get('/all-jobs', async (req, res) => {
            const page = parseInt(req.query.page)  
            const limit = parseInt(req.query.limit)  
            const skip = (page - 1) * limit; // Calculate how many documents to skip
            console.log(page,limit);
            
            const result = await jobsCollection.find().skip(skip).limit(limit).toArray();
            res.send(result)

        })
        // get all jobs from database for count
        app.get('/jobs-count', async (req, res) => {
            const count = await jobsCollection.countDocuments();
            res.send({ count })

        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})