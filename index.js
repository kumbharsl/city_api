const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cloudinary = require('cloudinary').v2;
const City = require('./models/City');

const app = express();
const PORT = process.env.PORT || 5000;

// Cloudinary configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create temporary uploads directory
const uploadsDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Multer configuration for temporary file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, `${Date.now()}-${sanitizedFilename}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload an image.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('Failed to connect to MongoDB', err);
});

// Swagger Configuration
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'City API',
            version: '1.0.0',
            description: 'API for managing cities with CRUD operations'
        },
        servers: [
            {
                url: process.env.BASE_URL || `http://localhost:${PORT}`,
                description: 'Server'
            }
        ],
    },
    apis: ['./index.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * components:
 *   schemas:
 *     City:
 *       type: object
 *       required:
 *         - name
 *         - phone
 *       properties:
 *         name:
 *           type: string
 *           description: The city name
 *         image:
 *           type: string
 *           description: The Cloudinary URL of the city image
 *         phone:
 *           type: string
 *           description: The city phone number
 */

/**
 * @swagger
 * /cities:
 *   post:
 *     summary: Create a new city
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: City created successfully
 *       400:
 *         description: Bad request
 */
app.post('/cities', upload.single('image'), async (req, res) => {
    try {
        const { name, phone } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: 'Image is required' });
        }

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path);
        
        const city = new City({
            name,
            image: result.secure_url,
            phone
        });

        await city.save();
        
        // Clean up temporary file
        fs.unlinkSync(req.file.path);
        
        res.status(201).json(city);
    } catch (err) {
        // Clean up temporary file in case of error
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /cities:
 *   get:
 *     summary: Get all cities
 *     responses:
 *       200:
 *         description: List of all cities
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/City'
 */
app.get('/cities', async (req, res) => {
    try {
        const cities = await City.find();
        res.json(cities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /cities/{id}:
 *   get:
 *     summary: Get a city by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: City details
 *       404:
 *         description: City not found
 */
app.get('/cities/:id', async (req, res) => {
    try {
        const city = await City.findById(req.params.id);
        if (!city) {
            return res.status(404).json({ error: 'City not found' });
        }
        res.json(city);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /cities/{id}:
 *   put:
 *     summary: Update a city
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: City updated successfully
 *       404:
 *         description: City not found
 */
app.put('/cities/:id', upload.single('image'), async (req, res) => {
    try {
        const updates = {
            name: req.body.name,
            phone: req.body.phone
        };

        if (req.file) {
            // Upload new image to Cloudinary
            const result = await cloudinary.uploader.upload(req.file.path);
            updates.image = result.secure_url;
            
            // Clean up temporary file
            fs.unlinkSync(req.file.path);

            // Delete old image from Cloudinary if exists
            const oldCity = await City.findById(req.params.id);
            if (oldCity && oldCity.image) {
                const publicId = oldCity.image.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(publicId);
            }
        }

        const city = await City.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        );

        if (!city) {
            return res.status(404).json({ error: 'City not found' });
        }

        res.json(city);
    } catch (err) {
        // Clean up temporary file in case of error
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /cities/{id}:
 *   delete:
 *     summary: Delete a city
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: City deleted successfully
 *       404:
 *         description: City not found
 */
app.delete('/cities/:id', async (req, res) => {
    try {
        const city = await City.findById(req.params.id);
        if (!city) {
            return res.status(404).json({ error: 'City not found' });
        }

        // Delete image from Cloudinary if exists
        if (city.image) {
            const publicId = city.image.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(publicId);
        }

        await City.findByIdAndDelete(req.params.id);
        res.json({ message: 'City deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File size is too large. Max limit is 5MB'
            });
        }
    }
    res.status(500).json({
        error: err.message || 'Internal Server Error'
    });
});

// Cleanup temporary files on server shutdown
process.on('SIGINT', () => {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    process.exit();
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
    console.log(`Swagger documentation available at ${process.env.BASE_URL || `http://localhost:${PORT}`}/api-docs`);
});