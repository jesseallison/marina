# Diamonds
A system for interactive poetry.

## Tasks

### To Do Now
- [*] Bring in Causeway-down-under cluster handling (Derick)
- [*] Make sure cluster handling works with texts, perhaps make this happen in a modular fashion.
- [*] Spin up some VMs for testing (Derick)

### To Do Later
- [ ] create a new node app that connects to redis database of Vincent clicks
- [ ] save Vincent controller clicks to redis database (Jesse)
- [ ] stand-alone version
  - don't show theater view
  - have overlay ontop of index.html view of the markoving
- [ ] Make 
- [ ] Have redis component be a separate module

### To Do One Day (NEXUS HUB)
- [ ] Visualization, sonic (browser), anyone (Max, OSC, etc)
- [ ] Mediated channels
- [ ] Mixins/Modules

### Done
- [x] TEDx transcript database
- [x] Server (app.js)
- [x] User
- [x] Controller
- [x] Theater
- [x] Audio
- [x] fix controller so it has split view (Derick)

## Technical Description
Each tap causes up to 10 entries from a csv to be joined into a single piece of text. Just one 3 sentence phrase is markoved together from this single piece of text is outputted to a queue ready to be viewed on the poet's controller screen. The poet clicks a next phrase button to see more availabe options. When the poet taps a phrae it gets sent to a theater view.


## User Interaction 1.0
- Reader speaks the poem from **controller** site.
- Audience members see the text from each section appear on their screen from **user** site.
- Audience members tap words from the text to assign weights to corresponding TED talks.
- The combination of corresponding talks create the corpus from which a new section of similar length is made. The weights increase with each word tap.
- After 10 seconds of tapping the new section gets projected in the **theater** view. 

## User Interaction 2.0
- The *new* sections get fed back to the **controller** view. 
- Correlation can be done with semantic comparison instead of word count.

## Setup
- Corpus is stored as corpus.csv in **data** folder. Must have at least a "content" column. Other columns can include data such as title, author, views, and keywords. 
- Score is stored as score.md in **data** folder.
- Each word in the score is correlated to a corpus item. This can be done by simply by looking for an item with the most occurances of the tapped word.

## Ideas
- Maybe use redis to store content

## FYI
- cat ../../diamonds/data/test1.csv | ./csv-loader myset
