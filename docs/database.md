\# Database Design



\## captures



Stores raw cognitive input.



Fields:

\- id

\- user\_id

\- transcript

\- summary

\- audio\_url

\- created\_at



\---



\## tasks



Executable items extracted from captures.



Fields:

\- id

\- user\_id

\- capture\_id

\- title

\- description

\- due\_date

\- status

\- confidence

\- created\_at



\---



\## events



Calendar-related extracted items.



Fields:

\- id

\- user\_id

\- capture\_id

\- title

\- start\_time

\- end\_time

\- confidence



\---



\## ideas



Non-executable cognitive insights.



Fields:

\- id

\- user\_id

\- capture\_id

\- title

\- content

\- created\_at

