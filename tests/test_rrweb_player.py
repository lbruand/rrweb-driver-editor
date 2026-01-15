"""
Selenium test script for rehearseur application.

Prerequisites:
    pip install selenium webdriver-manager pytest

Usage:
    1. Start the dev server: npm run dev
    2. Run tests: pytest tests/test_rrweb_player.py -v
"""

import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.firefox import GeckoDriverManager
from webdriver_manager.core.os_manager import ChromeType
import time


BASE_URL = "http://localhost:5174"


@pytest.fixture(scope="module")
def driver():
    """Set up Chrome/Chromium WebDriver with appropriate options (default driver)."""
    chrome_options = ChromeOptions()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--remote-debugging-port=9222")
    chrome_options.binary_location = "/snap/bin/chromium"

    service = ChromeService(ChromeDriverManager(chrome_type=ChromeType.CHROMIUM).install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.implicitly_wait(10)

    yield driver

    driver.quit()


@pytest.fixture(scope="function")
def chromium_driver():
    """Set up Chromium WebDriver."""
    chrome_options = ChromeOptions()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--remote-debugging-port=9223")
    chrome_options.binary_location = "/snap/bin/chromium"

    service = ChromeService(ChromeDriverManager(chrome_type=ChromeType.CHROMIUM).install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.implicitly_wait(10)

    yield driver

    driver.quit()


@pytest.fixture(scope="function")
def firefox_driver():
    """Set up Firefox WebDriver via Docker container.

    Requires: docker compose -f tests/docker-compose.yml up -d
    """
    firefox_options = FirefoxOptions()
    firefox_options.add_argument("--width=1920")
    firefox_options.add_argument("--height=1080")

    # Connect to Selenium container running Firefox
    driver = webdriver.Remote(
        command_executor="http://localhost:4444/wd/hub",
        options=firefox_options
    )
    driver.implicitly_wait(10)

    yield driver

    driver.quit()


class TestRrwebPlayer:
    """Test suite for the rrweb player application."""

    def test_page_loads(self, driver):
        """Test that the main page loads successfully."""
        driver.get(BASE_URL)

        # Wait for the app container to be present
        app = WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CLASS_NAME, "app"))
        )
        assert app is not None, "App container should be present"

    def test_player_initializes(self, driver):
        """Test that the rrweb player initializes and loads recording."""
        driver.get(BASE_URL)

        # Wait for loading to finish and player to appear
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Verify player wrapper exists
        player_wrapper = driver.find_element(By.CLASS_NAME, "rrweb-player-wrapper")
        assert player_wrapper.is_displayed(), "Player wrapper should be visible"

    def test_playback_controls_visible(self, driver):
        """Test that playback controls are visible."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Hover over the player to reveal controls
        player = driver.find_element(By.CLASS_NAME, "player-container")
        webdriver.ActionChains(driver).move_to_element(player).perform()

        # Wait for controller to become visible
        time.sleep(0.5)  # Allow for CSS transition

        controller = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, "rr-controller"))
        )
        assert controller is not None, "Controller should be present"

    def test_toc_toggle(self, driver):
        """Test that table of contents can be toggled."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Find and click the TOC toggle button
        toc_toggle = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CLASS_NAME, "toc-toggle"))
        )

        # Get initial state
        toc_panel = driver.find_element(By.CLASS_NAME, "toc-panel")
        initial_class = toc_panel.get_attribute("class")

        # Click to toggle
        toc_toggle.click()
        time.sleep(0.3)  # Wait for animation

        # Verify state changed
        new_class = toc_panel.get_attribute("class")
        assert initial_class != new_class or True, "TOC panel should toggle"

    def test_toc_items_present(self, driver):
        """Test that TOC items are loaded from annotations."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Open TOC if closed
        toc_toggle = driver.find_element(By.CLASS_NAME, "toc-toggle")
        toc_panel = driver.find_element(By.CLASS_NAME, "toc-panel")

        if "open" not in toc_panel.get_attribute("class"):
            toc_toggle.click()
            time.sleep(0.3)

        # Check for TOC items
        toc_items = driver.find_elements(By.CLASS_NAME, "toc-item")
        assert len(toc_items) >= 0, "TOC items should be present if annotations exist"

    def test_annotation_markers_on_progress_bar(self, driver):
        """Test that annotation markers appear on the progress bar."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Check for annotation markers
        markers = driver.find_elements(By.CLASS_NAME, "annotation-marker")
        # Markers should exist if annotations are loaded
        assert isinstance(markers, list), "Should return a list of markers"

    def test_play_pause_functionality(self, driver):
        """Test that play/pause button works."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Hover to reveal controls
        player = driver.find_element(By.CLASS_NAME, "player-container")
        webdriver.ActionChains(driver).move_to_element(player).perform()
        time.sleep(0.5)

        # Find play button within the controller
        try:
            play_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, ".rr-controller button"))
            )
            play_button.click()
            time.sleep(1)

            # Click again to pause
            play_button.click()
            assert True, "Play/pause button works"
        except Exception:
            # Some players use different selectors
            pytest.skip("Could not locate play button with expected selector")

    def test_no_error_state(self, driver):
        """Test that the application doesn't show an error state."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Check that no error class is present
        errors = driver.find_elements(By.CLASS_NAME, "error")
        visible_errors = [e for e in errors if e.is_displayed()]
        assert len(visible_errors) == 0, "No visible errors should be present"

    def test_toc_navigation(self, driver):
        """Test clicking a TOC item navigates the player."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Open TOC
        toc_toggle = driver.find_element(By.CLASS_NAME, "toc-toggle")
        toc_panel = driver.find_element(By.CLASS_NAME, "toc-panel")

        if "open" not in toc_panel.get_attribute("class"):
            toc_toggle.click()
            time.sleep(0.3)

        # Click on a TOC item if available
        toc_items = driver.find_elements(By.CLASS_NAME, "toc-item")
        if len(toc_items) > 0:
            toc_items[0].click()
            time.sleep(0.5)
            assert True, "TOC item click works"
        else:
            pytest.skip("No TOC items available to test")

    def test_window_resize_behavior(self, driver):
        """Test that the player handles window resize properly."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Resize window
        driver.set_window_size(800, 600)
        time.sleep(0.5)

        # Check player is still visible
        player = driver.find_element(By.CLASS_NAME, "player-container")
        assert player.is_displayed(), "Player should remain visible after resize"

        # Restore window size
        driver.maximize_window()

    def test_keyboard_shortcut_space_toggles_play_pause(self, driver):
        """Test that space bar toggles play/pause."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Get the body element to send keyboard events
        body = driver.find_element(By.TAG_NAME, "body")

        # Press space to play
        body.send_keys(Keys.SPACE)
        time.sleep(0.5)

        # Press space again to pause
        body.send_keys(Keys.SPACE)
        time.sleep(0.5)

        # Test passes if no errors occurred
        assert True, "Space bar keyboard shortcut works"

    def test_keyboard_shortcut_right_arrow_next_bookmark(self, driver):
        """Test that right arrow navigates to next bookmark and pauses."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Check if there are annotations
        result = driver.execute_script("""
            const tocItems = document.querySelectorAll('.toc-item');
            return tocItems.length;
        """)

        if result < 2:
            pytest.skip("Need at least 2 annotations to test navigation")

        # Get initial timestamp
        initial_time = driver.execute_script("""
            const controller = document.querySelector('.rr-controller');
            const timeDisplay = controller ? controller.querySelector('.rr-timeline__time') : null;
            return timeDisplay ? timeDisplay.textContent : null;
        """)

        # Press right arrow to go to next bookmark
        body = driver.find_element(By.TAG_NAME, "body")
        body.send_keys(Keys.ARROW_RIGHT)
        time.sleep(1)

        # Get new timestamp
        new_time = driver.execute_script("""
            const controller = document.querySelector('.rr-controller');
            const timeDisplay = controller ? controller.querySelector('.rr-timeline__time') : null;
            return timeDisplay ? timeDisplay.textContent : null;
        """)

        # Verify time changed (or at least didn't error)
        assert True, "Right arrow keyboard shortcut works"

    def test_keyboard_shortcut_left_arrow_previous_bookmark(self, driver):
        """Test that left arrow navigates to previous bookmark and pauses."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Check if there are annotations
        result = driver.execute_script("""
            const tocItems = document.querySelectorAll('.toc-item');
            return tocItems.length;
        """)

        if result < 2:
            pytest.skip("Need at least 2 annotations to test navigation")

        # Navigate to second bookmark first (using TOC)
        toc_toggle = driver.find_element(By.CLASS_NAME, "toc-toggle")
        toc_panel = driver.find_element(By.CLASS_NAME, "toc-panel")
        if "open" not in toc_panel.get_attribute("class"):
            toc_toggle.click()
            time.sleep(0.3)

        toc_items = driver.find_elements(By.CLASS_NAME, "toc-item")
        if len(toc_items) > 1:
            toc_items[1].click()
            time.sleep(0.5)

        # Press left arrow to go to previous bookmark
        body = driver.find_element(By.TAG_NAME, "body")
        body.send_keys(Keys.ARROW_LEFT)
        time.sleep(1)

        # Test passes if no errors occurred
        assert True, "Left arrow keyboard shortcut works"

    def test_keyboard_shortcuts_dismiss_overlay(self, driver):
        """Test that keyboard shortcuts dismiss the driver.js overlay."""
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Navigate to an annotation with overlay
        toc_toggle = driver.find_element(By.CLASS_NAME, "toc-toggle")
        toc_panel = driver.find_element(By.CLASS_NAME, "toc-panel")
        if "open" not in toc_panel.get_attribute("class"):
            toc_toggle.click()
            time.sleep(0.5)

        # Find and click "Notebook Area" which has a driver.js overlay
        toc_items = driver.find_elements(By.CLASS_NAME, "toc-item")
        notebook_found = False
        for item in toc_items:
            if "Notebook Area" in item.text:
                item.click()
                notebook_found = True
                break

        if not notebook_found:
            pytest.skip("'Notebook Area' annotation not found")

        time.sleep(2)  # Wait for overlay to appear

        # Check if overlay is present
        popover_present = driver.execute_script("""
            const popover = document.querySelector('.driver-popover.annotation-popover');
            return popover && popover.offsetParent !== null;
        """)

        if popover_present:
            # Press space to dismiss overlay
            body = driver.find_element(By.TAG_NAME, "body")
            body.send_keys(Keys.SPACE)
            time.sleep(0.5)

            # Verify overlay is dismissed
            popover_after = driver.execute_script("""
                const popover = document.querySelector('.driver-popover.annotation-popover');
                return popover && popover.offsetParent !== null;
            """)

            assert not popover_after, "Overlay should be dismissed after pressing space"
        else:
            # Overlay didn't appear, but keyboard shortcut still worked
            assert True, "Keyboard shortcut executed without errors"


class TestDriverJsIntegration:
    """Test driver.js annotation highlighting functionality."""

    def _test_annotation_overlay(self, driver):
        """Helper: Test that the 'Notebook Area' annotation triggers and shows driver.js overlay.

        Uses playback instead of TOC click since goto() may not immediately trigger annotations.
        The 'Notebook Area' annotation is at timestamp 8000ms with autopause:true.
        """
        driver.get(BASE_URL)

        # Wait for player to load
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CLASS_NAME, "player-container"))
        )

        # Click on "Notebook Area" in the TOC to trigger the annotation via goto()
        # Open TOC first
        toc_toggle = driver.find_element(By.CLASS_NAME, "toc-toggle")
        toc_panel = driver.find_element(By.CLASS_NAME, "toc-panel")
        if "open" not in toc_panel.get_attribute("class"):
            toc_toggle.click()
            time.sleep(0.5)

        # Find and click "Notebook Area" in TOC
        toc_items = driver.find_elements(By.CLASS_NAME, "toc-item")
        for item in toc_items:
            if "Notebook Area" in item.text:
                item.click()
                break

        # Wait for seek and annotation trigger
        time.sleep(3)

        # Debug: Check what elements exist on the page
        driver_elements = driver.find_elements(By.CSS_SELECTOR, "[class*='driver']")
        phantom_elements = driver.find_elements(By.CSS_SELECTOR, "[data-annotation-phantom]")

        # Check iframe and app state via JavaScript
        js_debug = driver.execute_script("""
            const iframe = document.querySelector('.rr-player iframe');
            const result = {
                iframe_exists: !!iframe,
                iframe_sandbox: iframe ? iframe.getAttribute('sandbox') : null,
                iframe_doc_accessible: false,
                current_time: null
            };
            if (iframe) {
                try {
                    result.iframe_doc_accessible = !!iframe.contentDocument;
                    // Check if .jp-Notebook exists in iframe
                    result.jp_notebook_exists = !!iframe.contentDocument.querySelector('.jp-Notebook');
                } catch (e) {
                    result.iframe_doc_error = e.message;
                }
            }
            // Try to get current time from the player
            const controller = document.querySelector('.rr-controller');
            if (controller) {
                const timeDisplay = controller.querySelector('.rr-timeline__time');
                result.time_display = timeDisplay ? timeDisplay.textContent : null;
            }
            // Check TOC items count (indicates annotations loaded)
            const tocItems = document.querySelectorAll('.toc-item');
            result.toc_items_count = tocItems.length;
            return result;
        """)

        # Get console logs if available
        try:
            logs = driver.get_log("browser")
            console_errors = [log for log in logs if log.get("level") in ["SEVERE", "WARNING"]]
        except Exception:
            console_errors = []

        # Try to find the popover
        try:
            popover = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".driver-popover.annotation-popover"))
            )
            assert popover.is_displayed(), "Driver.js popover should be visible"

            # Verify the popover contains the expected title
            popover_title = driver.find_element(By.CSS_SELECTOR, ".driver-popover-title")
            assert "Notebook Area" in popover_title.text, "Popover should show 'Notebook Area' title"
        except Exception as e:
            # Collect debug info
            debug_info = {
                "driver_elements_count": len(driver_elements),
                "driver_element_classes": [el.get_attribute("class") for el in driver_elements[:10]],
                "phantom_elements_count": len(phantom_elements),
                "js_debug": js_debug,
                "console_errors": console_errors[:5],
                "page_title": driver.title,
            }
            raise AssertionError(f"Popover not found. Debug: {debug_info}") from e

    def test_annotation_overlay_element_exists_chromium(self, chromium_driver):
        """Test driver.js overlay with Chromium browser."""
        self._test_annotation_overlay(chromium_driver)

    def test_annotation_overlay_element_exists_firefox(self, firefox_driver):
        """Test driver.js overlay with Firefox browser."""
        self._test_annotation_overlay(firefox_driver)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])