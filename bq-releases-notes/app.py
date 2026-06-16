from flask import Flask, render_template, jsonify, request
import requests
import xml.etree.ElementTree as ET
import re
from datetime import datetime

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# Simple in-memory cache to prevent unnecessary hits on the live XML feed
cache = {
    "data": None,
    "last_fetched": None
}

def clean_html(text):
    """Strip HTML tags to get raw text for tweeting/preview."""
    # Replace block tags with space to preserve spacing
    text = re.sub(r'</?(p|div|br|li|ul|ol|h3|h4|h5)[^>]*>', ' ', text)
    # Remove all other HTML tags
    clean = re.compile('<.*?>')
    return re.sub(clean, '', text).strip()

def parse_release_notes(xml_content):
    """Parse BigQuery Release Notes Atom Feed XML content."""
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        print(f"XML Parse Error: {e}")
        return []

    namespace = {'atom': 'http://www.w3.org/2005/Atom'}
    updates = []
    idx = 0

    for entry in root.findall('atom:entry', namespace):
        title_elem = entry.find('atom:title', namespace)
        date_str = title_elem.text.strip() if title_elem is not None else "Unknown Date"
        
        updated_elem = entry.find('atom:updated', namespace)
        updated_iso = updated_elem.text.strip() if updated_elem is not None else ""
        
        link_elem = entry.find('atom:link', namespace)
        link = ""
        if link_elem is not None:
            link = link_elem.attrib.get('href', '')

        content_elem = entry.find('atom:content', namespace)
        if content_elem is None:
            continue

        html_content = content_elem.text or ""
        
        # Split content by <h3> tags to extract individual updates
        parts = re.split(r'<h3>(.*?)</h3>', html_content)
        
        if len(parts) > 1:
            for i in range(1, len(parts), 2):
                category = parts[i].strip()
                content_html = parts[i+1].strip() if i+1 < len(parts) else ""
                
                # Create a clean text representation
                text_content = clean_html(content_html)
                text_content = re.sub(r'\s+', ' ', text_content)
                
                # Check for specific deep-link anchor in entry title
                # e.g., June_15_2026 from "June 15, 2026"
                anchor = date_str.replace(" ", "_").replace(",", "")
                deep_link = f"{link}#{anchor}" if link else ""

                updates.append({
                    "id": f"update-{idx}",
                    "date": date_str,
                    "updated_iso": updated_iso,
                    "category": category,
                    "content_html": content_html,
                    "content_text": text_content,
                    "link": deep_link or link
                })
                idx += 1
        else:
            # Fallback if no <h3> headings exist
            text_content = clean_html(html_content)
            text_content = re.sub(r'\s+', ' ', text_content)
            updates.append({
                "id": f"update-{idx}",
                "date": date_str,
                "updated_iso": updated_iso,
                "category": "General",
                "content_html": html_content,
                "content_text": text_content,
                "link": link
            })
            idx += 1

    return updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    # Check cache unless refresh is explicitly requested
    if not force_refresh and cache["data"] and cache["last_fetched"]:
        time_diff = datetime.now() - cache["last_fetched"]
        # Cache for 1 hour
        if time_diff.total_seconds() < 3600:
            return jsonify({
                "status": "success",
                "source": "cache",
                "last_fetched": cache["last_fetched"].isoformat(),
                "updates": cache["data"]
            })

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        updates = parse_release_notes(response.content)
        
        cache["data"] = updates
        cache["last_fetched"] = datetime.now()
        
        return jsonify({
            "status": "success",
            "source": "live",
            "last_fetched": cache["last_fetched"].isoformat(),
            "updates": updates
        })
    except Exception as e:
        print(f"Error fetching live feed: {e}")
        # Fall back to cache if live call fails
        if cache["data"]:
            return jsonify({
                "status": "success",
                "source": "cache_fallback",
                "warning": f"Could not refresh live feed: {str(e)}. Showing cached data.",
                "last_fetched": cache["last_fetched"].isoformat(),
                "updates": cache["data"]
            })
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch release notes: {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
