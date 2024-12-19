This project implements an access control mechanism using Solidity smart contracts. It includes tests to ensure the functionality of the contracts.

Installation:

    Node.js and npm:
    Ensure you have Node.js and npm (Node Package Manager) installed on your system. You can download them from the official Node.js website.   

Clone the Repository:
Clone this repository to your local machine using Git:
Bash

git clone https://github.com/batuhantnrkulu/Access_Control_Mechanism.git

Install Dependencies:
Navigate to the project directory and install the required dependencies:
Bash

    cd Access_Control_Mechanism
    npm install

Running the Tests:

Start a Local Ganache Network:
Open a new terminal window and run the following command to start a local Ganache network with 25 accounts:

![Example Image](readme1.png)
Bash

    npx ganache -a 25

Compile and Run Tests:
In another terminal window, navigate to the project directory and run the following command to compile the contracts and execute the tests:
Bash

    truffle test ./test/AccessControlContract.test.js --network development

Additional Notes:

Make sure you have the Truffle framework installed globally. You can install it using npm:
Bash

    npm install -g truffle

If you encounter any issues, refer to the Truffle documentation for troubleshooting and advanced usage.
