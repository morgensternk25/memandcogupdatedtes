# Memory and Encoding Strategies Experiment

A static browser-based free-recall experiment built with plain HTML, CSS, and JavaScript.

## Files
- `index.html` — page structure
- `styles.css` — presentation
- `script.js` — randomization, timing, scoring, and CSV downloads

## Run locally
Open `index.html` directly in a modern browser. No server, framework, build step, or database is required.

## Experiment flow
1. A new session independently shuffles the three encoding strategies and assigns one of the three six-word lists to each strategy.
2. Each block begins with strategy instructions.
3. Six words appear for 3 seconds each.
4. Participants count backward by 3 from a random three-digit number for 30 seconds.
5. Participants freely recall words in a text box.
6. Results are scored by strategy and two CSV files can be downloaded.

## CSV files
- `memory_experiment_summary.csv`: one row per session, including strategy order, strategy scores, overall score, and distractor-task summary.
- `memory_experiment_trials.csv`: 18 rows per session, one for each studied word, with strategy assignment and recall outcome.

## Notes
- The recall scorer ignores capitalization and punctuation, accepts common plurals, and allows small typographical errors using a conservative edit-distance rule. Ambiguous matches are not credited automatically.
- Data are not uploaded or saved to a server. Participants must download both CSV files before closing the results page.
- The distractor task records submitted entries and whether each entry was correct. Incorrect entries do not reset the expected sequence.
- The strategy order and list-to-strategy pairing are randomized independently for every new session.
