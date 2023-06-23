const { ApolloServer } = require("@apollo/server");
const {  startStandaloneServer } = require("@apollo/server/standalone");

const { readFileSync } = require("fs");
const path = require("path");
require('dotenv').config();

const mongoose = require('mongoose')
mongoose.set('strictQuery', false)
const Person = require("./Model/Person");
const User = require("./Model/User");

const { GraphQLError } = require("graphql");
const jwt = require("jsonwebtoken");

const PORT = process.env.PORT;

const resolvers = {
    Query: {
        personCount: async () => Person.collection.countDocuments(),
        allPersons: async (root, args) => {
            if(!args.phone){
                return Person.find({})
            }

            return Person.find({ phone: { $exists: args.phone === 'YES'}})
        },
        findPerson: async (root, args) => {
            Person.findOne({ name: args.name })
        },
        me: (root, args, context) => {
            return context.currentUser
        }
    },
    Person: {
        address: async ({ street, city }) => {
            return {
                street,
                city
            }
        }
    },
    Mutation: {
        addPerson: async (root, args, context) => {
            const person = new Person({ ...args })
            const currentUser = context.currentUser;

            if(!currentUser){
                throw new GraphQLError("Not authenticated", {
                    extensions: {
                        code: "BAD_USER_INPUT"
                    }
                })
            }


            try {
                await person.save();
                currentUser.friends = currentUser.friends.concat(person)
                await currentUser.save();
            } catch (err) {
                throw new GraphQLError('Saving user failed', {
                    extensions: {
                        code: "BAD_USER_INPUT",
                        invalidArgs: args,
                        err
                    }
                })
            }
            return person;
        },
        editNumber: async (root, args) => {
            const person = await Person.findOne({ name: args.name });
            person.phone = args.phone;
            try {
                await person.save();
            } catch (err) {
                throw new GraphQLError('Editing number failed', {
                    extensions: {
                        code: "BAD_USER_INPUT",
                        invalidArgs: args.name,
                        err
                    }
                })
            }
            return person;
        },
        createUser: async (root, args) => {
            const user = new User({ username: args.username })
            return user.save().catch((err) => {
                throw new GraphQLError("Creating user failed!", {
                    extensions: {
                        code: "BAD_USER_INPUT",
                        invalidArgs: args.name,
                        err
                    }
                })
            })
        },
        login: async (root, args) => {
            const user = await User.findOne({ username: args.username });

            if(!user || args.password !== 'secret') {
                throw new GraphQLError("Wrong credentials", {
                    extensions: {
                        code: "BAD_USER_INPUT"
                    }
                })
            }

            const userForToken = {
                username: user.username,
                id: user._id
            }

            
            return {
                value: jwt.sign(userForToken, process.env.JWT_SECRET)
            }
        },
        addAsFriend: async (root, args, { currentUser }) => {
            const isFriend = (person) => 
              currentUser.friends.map(f => f._id.toString()).includes(person._id.toString())
        
            if (!currentUser) {
              throw new GraphQLError('wrong credentials', {
                extensions: { 
                    code: 'BAD_USER_INPUT' 
                }
              }) 
            }
        
            const person = await Person.findOne({ name: args.name })
            if ( !isFriend(person) ) {
              currentUser.friends = currentUser.friends.concat(person)
            }
        
            await currentUser.save();
            return currentUser;
          },
    }
}

const server = new ApolloServer({
    typeDefs: readFileSync(path.join(__dirname, "schema.graphql"), "utf-8"),
    resolvers
});
startStandaloneServer(server, {
    listen: { port : PORT },
    context: async ({ req, res }) => {
        const auth = req ? req.headers.authorization : null
        if (auth && auth.startsWith('Bearer ')) {
          const decodedToken = jwt.verify(
            auth.substring(7), process.env.JWT_SECRET
          )
          const currentUser = await User
            .findById(decodedToken.id).populate('friends')
          return { currentUser }
        }
      },
}).then((res) => console.log(res.url))