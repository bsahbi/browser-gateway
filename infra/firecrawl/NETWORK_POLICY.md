# Workplane Browser Gateway - Network Policy
# Default-deny egress with explicitly allowed destinations
# Applies to all Firecrawl services

# ============================================
# EGRESS POLICY SUMMARY
# ============================================

# ALLOWED DESTINATIONS:
# 1. Public internet (HTTP/HTTPS on standard ports)
# 2. DNS (UDP/TCP port 53) - explicit allow
# 
# BLOCKED DESTINATIONS:
# 1. Private IP ranges:
#    - 10.0.0.0/8 (private class A)
#    - 172.16.0.0/12 (private class B)
#    - 192.168.0.0/16 (private class C)
#    - 127.0.0.0/8 (loopback)
#    - 169.254.0.0/16 (link-local)
#    - 0.0.0.0/0 (default route)
# 2. Cloud metadata endpoints:
#    - 169.254.169.254 (AWS, Azure, GCP metadata)
#    - 169.254.169.253 (specialized metadata)
# 3. Internal services (non-public ranges)
# 4. IPv6 link-local: fe80::/10
#
# PROTOCOLS ALLOWED:
# - HTTP (TCP 80)
# - HTTPS (TCP 443)
# - DNS (UDP/TCP 53)
#
# PROXY BEHAVIOR:
# - All egress goes through system proxy if configured
# - Proxy must enforce same destination restrictions
# - Browser subprocesses inherit proxy settings

# ============================================
# SSRF PROTECTION
# ============================================

# The following protections are enforced at multiple layers:
# 1. DNS-level: Block resolution of private/internal hostnames
# 2. Network-level: Block connection to private IP ranges
# 3. Redirect-level: Validate redirects don't follow to blocked destinations
# 4. Protocol-level: Block non-HTTP(S) protocols in fetch requests
#
# IMPORTANT: URL regex validation alone is insufficient.
# Protection must be at the connection/network layer.

# ============================================
# IPv4/IPv6 PROTECTION
# ============================================

# Both IPv4 and IPv6 must be protected:
# - Block IPv6 private ranges: fec0::/10, fe80::/10, fc00::/7
# - Block IPv6 loopback: ::1/128
# - Ensure proxy supports both protocol versions

# ============================================
# FIREWALL RULES (SUGGESTED)
# ============================================

# For Linux hosts, recommended iptables/nftables rules:
# 
# # Allow established connections
# iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
# 
# # Allow DNS
# iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
# 
# # Allow public internet only (exclude private ranges)
# iptables -A OUTPUT -d 10.0.0.0/8 -j DROP
# iptables -A OUTPUT -d 172.16.0.0/12 -j DROP
# iptables -A OUTPUT -d 192.168.0.0/16 -j DROP
# iptables -A OUTPUT -d 127.0.0.0/8 -j DROP
# iptables -A OUTPUT -d 169.254.0.0/16 -j DROP
# iptables -A OUTPUT -d 0.0.0.0/8 -j DROP
# iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT
# iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
# 
# # Default deny
# iptables -A OUTPUT -j DROP
#
# For Docker, ensure containers use the same host network policy
# or configure custom bridge network with restricted routing.

# ============================================
# BROWSER SUBPROCESS PROTECTION
# ============================================

# Browser processes (Chromium/Playwright) can bypass proxy settings.
# Ensure:
# 1. Browser sandbox is enabled (enabled by default in Firecrawl)
# 2. No privileged mode for browser containers
# 3. Network namespace isolation via Docker
# 4. Seccomp/AppArmor profiles applied
# 5. No host network mode (--network host)

# ============================================
# VALIDATION REQUIREMENTS
# ============================================

# Before deployment, validate:
# 1. No direct connection to private IPs possible
# 2. Metadata endpoints unreachable (169.254.169.254)
# 3. DNS rebinding prevented
# 4. Redirects validated against allowlist
# 5. IPv6 traffic also blocked for private ranges
# 6. Browser subprocess cannot bypass network policy

# ============================================
# NETWORK ACCOUNTING (P0)
# ============================================

# For P0, use aggregate host-level accounting:
# - Monitor total egress bytes via host firewall counters
# - Set hard transfer ceiling at host level (if available)
# - Document residual cost exposure for operator approval
# - Per-tenant attribution deferred to P3
#
# WARNING: Without per-job network identities or dedicated
# workers, hard tenant-specific caps are NOT achievable
# in shared pool. Block commercial launch for such capabilities
# until P3 Control Plane is implemented.

# ============================================
# OPERATOR KILL SWITCH
# ============================================

# Network-level kill switch:
# 1. Stop all egress at firewall level
# 2. Restart affected services to clear connections
# 3. Verify no orphaned connections remain
#
# Job-level kill switch:
# 1. API endpoint to cancel active jobs
# 2. RabbitMQ queue drain/restart
# 3. Playwright browser force termination
