import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken"

interface DecodedToken {
    userId: string;
}

export const verifyIdToken = ( req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          res.status(500).json({ message: 'JWT_SECRET not configured' });
          return;
        }
        const decoded = jwt.verify(token, jwtSecret) as DecodedToken;
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
};


