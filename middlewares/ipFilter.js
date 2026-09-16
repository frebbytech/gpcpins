const ipaddr = require('ipaddr.js');

/**
 * Normalize an IP address.
 *
 * Examples:
 *   ::ffff:127.0.0.1 -> 127.0.0.1
 *   52.157.161.21    -> 52.157.161.21
 */
function normalizeIp(ip) {
    if (!ip) return null;

    try {
        let address = ipaddr.parse(ip);

        // Convert IPv4-mapped IPv6 addresses to IPv4
        if (address.kind() === 'ipv6' && address.isIPv4MappedAddress()) {
            address = address.toIPv4Address();
        }

        return address.toString();
    } catch {
        return null;
    }
}

/**
 * Check whether an IP belongs to a CIDR range.
 */
function ipMatchesCidr(ip, cidr) {
    try {
        const address = ipaddr.parse(ip);
        const [range, prefixLength] = ipaddr.parseCIDR(cidr);

        // IPv4 and IPv6 must be compared within the same family.
        if (address.kind() !== range.kind()) {
            return false;
        }

        return address.match(range, prefixLength);
    } catch {
        return false;
    }
}

/**
 * Check whether an IP matches an allowlist entry.
 *
 * Supports:
 *   52.157.161.21
 *   52.157.161.0/24
 *   2001:db8::/32
 */
function ipAllowed(ip, allowedIps) {
    for (const allowed of allowedIps) {
        if (!allowed) continue;

        const normalizedAllowed = normalizeIp(allowed);

        if (!normalizedAllowed) {
            // CIDR
            if (allowed.includes('/')) {
                if (ipMatchesCidr(ip, allowed)) {
                    return true;
                }
            }

            continue;
        }

        if (ip === normalizedAllowed) {
            return true;
        }
    }

    return false;
}

/**
 * Express IP allowlist middleware.
 *
 * Usage:
 *
 * app.use(
 *     ipFilter({
 *         allowedIps: ['52.157.161.21']
 *     })
 * );
 *
 * Or:
 *
 * app.post(
 *     '/payment/callback',
 *     ipFilter({
 *         allowedIps: ['52.157.161.21']
 *     }),
 *     callbackController
 * );
 */
function ipFilter(options = {}) {
    const {
        allowedIps = [],
        trustProxy = true,
        onDenied = null,
    } = options;

    if (!Array.isArray(allowedIps) || allowedIps.length === 0) {
        throw new Error(
            'ipFilter: allowedIps must contain at least one IP address or CIDR range'
        );
    }

    return (req, res, next) => {
        let clientIp;

        if (trustProxy) {
            // Express resolves this using X-Forwarded-For when
            // "trust proxy" is configured correctly.
            clientIp = req.ip;
        } else {
            clientIp = req.socket?.remoteAddress;
        }

        clientIp = normalizeIp(clientIp);

        if (!clientIp) {
            console.warn('IP filter: unable to determine client IP', {
                method: req.method,
                url: req.originalUrl,
            });

            return res.status(403).json({
                status: 403,
                message: 'Access denied',
            });
        }

        if (ipAllowed(clientIp, allowedIps)) {
            return next();
        }

        const denial = {
            status: 403,
            ip: clientIp,
            method: req.method,
            url: req.originalUrl,
        };

        console.warn('IP filter denied request:', denial);

        if (typeof onDenied === 'function') {
            onDenied({
                req,
                ip: clientIp,
            });
        }

        return res.status(403).json({
            status: 403,
            message: `Access denied to IP address: ${clientIp}`,
        });
    };
}

module.exports = {
    ipFilter,
    normalizeIp,
    ipAllowed,
};