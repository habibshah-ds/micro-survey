export class ApiResponse {
  static success(res, statusCode = 200, message = "Success", data = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static created(res, message = "Created", data = {}) {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  }

  static paginated(res, data, page, limit, total, message = "Success") {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  }
}
