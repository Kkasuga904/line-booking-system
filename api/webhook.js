module.exports = async (req, res) => {
    // Simple response for any request
    res.status(200).json({
        status: 'OK',
        method: req.method,
        message: 'Webhook endpoint is working'
    });
};