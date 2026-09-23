import cloudinary from '../config/cloudinary.js';

/**
 * Uploads a file buffer from multer memoryStorage to Cloudinary.
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} folder - Destination folder in Cloudinary
 * @returns {Promise<{url: string, public_id: string}>}
 */
export const uploadToCloudinary = (fileBuffer, folder = 'foodypay_logos') => {
  return new Promise((resolve, reject) => {
    // If Cloudinary environment variables are missing, handle gracefully
    if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your_cloudinary_cloud_name') {
      console.warn('Cloudinary credentials missing in .env - Returning placeholder logo schema');
      return resolve({
        url: 'https://via.placeholder.com/150?text=Logo',
        public_id: 'placeholder_logo_id',
      });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};
