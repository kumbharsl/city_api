const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const City = require('./models/City');

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(uploadsDir));

// Multer configuration for file uploads
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
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/citydb', {
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
                url: `http://localhost:${PORT}`,
                description: 'Development server'
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
 *           description: The path to the city image
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

        const relativePath = path.relative(__dirname, req.file.path)
            .split(path.sep)
            .join('/');

        const city = new City({
            name,
            image: relativePath,
            phone
        });

        await city.save();
        res.status(201).json({
            ...city.toObject(),
            imageUrl: `/uploads/${path.basename(req.file.path)}`
        });
    } catch (err) {
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
        const citiesWithUrls = cities.map(city => ({
            ...city.toObject(),
            imageUrl: `/uploads/${path.basename(city.image)}`
        }));
        res.json(citiesWithUrls);
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
        res.json({
            ...city.toObject(),
            imageUrl: `/uploads/${path.basename(city.image)}`
        });
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
            const relativePath = path.relative(__dirname, req.file.path)
                .split(path.sep)
                .join('/');
            updates.image = relativePath;

            // Delete old image if it exists
            const oldCity = await City.findById(req.params.id);
            if (oldCity && oldCity.image) {
                const oldImagePath = path.join(__dirname, oldCity.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
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

        res.json({
            ...city.toObject(),
            imageUrl: `/uploads/${path.basename(city.image)}`
        });
    } catch (err) {
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

        // Delete the image file if it exists
        if (city.image) {
            const imagePath = path.join(__dirname, city.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
    console.log(`Uploads directory: ${uploadsDir}`);
});