/* Loaded with `nomodule`, so only browsers too old for ES modules run it — exactly the browsers
   that can never run the deletion flow. Without it they would sit on a page of permanently
   disabled buttons with no explanation. Deliberately ES5: no let/const, no arrow functions. */
(function () {
    var status = document.querySelector("#status");
    if (status != null) {
        status.textContent = "This browser is too old for verified self-service deletion. "
            + "Nothing was deleted; update your browser or email contact@playleh.com.";
        status.className = "status status-error";
        status.hidden = false;
    }
})();
